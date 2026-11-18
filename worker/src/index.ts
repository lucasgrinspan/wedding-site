import rsvpLookupData from "../data/rsvp_lookup.json";
import {
  encodeDelightHeader,
  resolveEmailNoteForSubmission,
  resolveGuestDelight,
} from "./delights";
import {
  buildConfirmationEmailHtml,
  buildConfirmationEmailText,
  buildHostNotificationEmailHtml,
  buildHostNotificationEmailText,
  getConfirmationEmailSubject,
  getHostNotificationEmailSubject,
} from "./email";
import {
  computePartyKey,
  exportAllRsvps,
  formatRsvpsAsCsv,
  listPendingHostNotifications,
  persistRsvpSubmission,
  recordLookupMiss,
  updateDeliveryStatus,
} from "./storage";
import {
  GuestResponse,
  RsvpSubmissionPayload,
  SubmitResult,
} from "./types";

const rawLookupData = rsvpLookupData as Record<string, unknown>;

const MAX_BODY_BYTES = 64 * 1024;
const TEST_CONFIRM_WINDOW_MS = 10 * 60 * 1000;
const TEST_CONFIRM_MAX_PER_WINDOW = 6;
let testConfirmWindowStart = 0;
let testConfirmCount = 0;

function allowTestPartyConfirmationEmail(): boolean {
  const now = Date.now();
  if (now - testConfirmWindowStart > TEST_CONFIRM_WINDOW_MS) {
    testConfirmWindowStart = now;
    testConfirmCount = 0;
  }
  if (testConfirmCount >= TEST_CONFIRM_MAX_PER_WINDOW) {
    return false;
  }
  testConfirmCount += 1;
  return true;
}
const MAX_DIETARY_LENGTH = 2000;
const MAX_EXTRA_VALUE_LENGTH = 500;
const RESEND_TIMEOUT_MS = 8000;

/**
 * Normalizes a name string by removing diacritics/accents, lowercasing,
 * and stripping non-alphanumeric characters to match keys in rsvp_lookup.json.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function getLookupKey(first: string, last: string): string {
  return normalizeName(`${first}${last}`);
}

const HONORIFIC_PREFIXES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "mx",
  "dr",
  "prof",
  "sr",
  "sra",
  "srta",
  "don",
  "dona",
]);

function stripHonorificTokens(raw: string): string {
  const tokens = raw.trim().split(/[\s.]+/).filter(Boolean);
  while (tokens.length > 1 && HONORIFIC_PREFIXES.has(normalizeName(tokens[0]))) {
    tokens.shift();
  }
  return tokens.join(" ");
}

/**
 * Common English & Spanish given-name nickname clusters.
 * Used only when a `(firstVariant + lastName)` match uniquely identifies 1 party (`aliasMatches.size === 1`).
 */
const COMMON_FIRST_NAME_CLUSTERS: string[][] = [
  ["rob", "robbie", "robby", "robert", "roberto", "bobby", "bob"],
  ["will", "willie", "willy", "william", "bill", "billy", "liam"],
  ["matt", "matty", "matthew", "mateo"],
  ["mike", "mikey", "michael", "miguel"],
  ["tony", "anthony", "antonio"],
  ["tere", "teresa", "teresita"],
  ["liz", "lizzy", "beth", "eliza", "elizabeth", "elisabeth"],
  ["gaby", "gabi", "gabby", "gabriela", "gabriella"],
  ["coni", "connie", "coti", "coty", "constanza"],
  ["nati", "naty", "nat", "natalia", "natalie"],
  ["chris", "christine", "christina", "christian", "christopher", "cristian", "cristina"],
  ["greg", "gregory", "gregorio"],
  ["phil", "phillip", "philip", "felipe"],
  ["stu", "stuart", "stewart"],
  ["steve", "steven", "stephen", "esteban"],
  ["javi", "javier"],
  ["rick", "ricky", "rich", "ricardo", "richard"],
  ["bea", "beatrice", "beatriz"],
  ["trini", "trinidad"],
  ["alex", "alexander", "alejandro", "alexandra", "alejandra"],
  ["dan", "danny", "daniel", "dani"],
  ["dave", "david"],
  ["joe", "joey", "joseph", "jose"],
  ["kate", "katie", "kathy", "katherine", "catherine", "catalina"],
  ["sam", "samuel", "samantha"],
  ["nick", "nico", "nicholas", "nicolas"],
  ["fran", "francisco", "francisca", "frank"],
  ["pato", "patricio", "patricia", "pat", "patty"],
  ["lucho", "luciano", "luis"],
  ["nachito", "nacho", "ignacio"],
];

function isTestPartyNames(party: string[]): boolean {
  return party.some((member) => {
    const norm = normalizeName(member);
    return norm === "mrpenny" || norm === "mrspenny" || norm === "penny";
  });
}

const { lookupRecord, firstNameAliases, canonicalPartiesByKey } = (() => {
  const records: Record<string, string[]> = {};
  const aliases: Record<string, string[]> = {};
  const partiesByKey = new Map<string, string[]>();

  for (const [key, val] of Object.entries(rawLookupData)) {
    if (key.startsWith("_") || !Array.isArray(val)) continue;
    const party = val.map((m) => String(m));
    records[normalizeName(key)] = party;
    const partyKey = party
      .map((m) => normalizeName(m))
      .filter(Boolean)
      .sort()
      .join("|");
    if (partyKey && !partiesByKey.has(partyKey)) {
      partiesByKey.set(partyKey, party);
    }
  }

  const addFirstAlias = (alias: string, canonical: string) => {
    const normAlias = normalizeName(alias);
    const normCanon = normalizeName(canonical);
    if (!normAlias || !normCanon || normAlias === normCanon) return;
    const list = aliases[normAlias] ?? [];
    if (!list.includes(normCanon)) {
      list.push(normCanon);
    }
    aliases[normAlias] = list;
  };

  for (const cluster of COMMON_FIRST_NAME_CLUSTERS) {
    for (const a of cluster) {
      for (const b of cluster) {
        if (a !== b) {
          addFirstAlias(a, b);
        }
      }
    }
  }

  const rawAliases = rawLookupData._aliases ?? rawLookupData.aliases;
  if (rawAliases && typeof rawAliases === "object" && !Array.isArray(rawAliases)) {
    for (const [rawKey, rawVal] of Object.entries(rawAliases as Record<string, unknown>)) {
      const normKey = normalizeName(rawKey);
      const valList = Array.isArray(rawVal)
        ? rawVal.map((v) => String(v))
        : typeof rawVal === "string"
        ? [rawVal]
        : [];

      if (records[normKey]) {
        const party = records[normKey];
        const canonFirst = normalizeName(rawKey.trim().split(/[\s-]+/)[0] || rawKey);
        for (const aliasStr of valList) {
          const normAliasFull = normalizeName(aliasStr);
          if (!normAliasFull) continue;
          const aliasTokens = aliasStr.trim().split(/[\s-]+/).filter(Boolean);
          if (aliasTokens.length > 1) {
            records[normAliasFull] = party;
          }
          if (aliasTokens.length >= 1) {
            addFirstAlias(aliasTokens[0], canonFirst);
          }
        }
      } else {
        for (const target of valList) {
          const normTarget = normalizeName(target);
          if (records[normTarget]) {
            records[normKey] = records[normTarget];
            const aliasFirst = rawKey.trim().split(/[\s-]+/)[0] || rawKey;
            const targetFirst = target.trim().split(/[\s-]+/)[0] || target;
            addFirstAlias(aliasFirst, targetFirst);
          } else {
            addFirstAlias(rawKey, target);
          }
        }
      }
    }
  }

  return {
    lookupRecord: records,
    firstNameAliases: aliases,
    canonicalPartiesByKey: partiesByKey,
  };
})();

const ALLOWED_ORIGINS = new Set([
  "https://lucasandlianne.com",
  "https://www.lucasandlianne.com",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
]);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

/**
 * Generates CORS headers restricted to authorized wedding site origins with Vary: Origin.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : "https://lucasandlianne.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Expose-Headers": "X-Matched-Guest, X-Rsvp-Delight",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/**
 * Computes the standard Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

function isAdjacentTransposition(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  let diffIndex = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (diffIndex === -1) {
        diffIndex = i;
      } else if (
        diffIndex === i - 1 &&
        a[diffIndex] === b[i] &&
        a[i] === b[diffIndex] &&
        a.slice(i + 1) === b.slice(i + 1)
      ) {
        return true;
      } else {
        return false;
      }
    }
  }
  return false;
}

interface StructuredCandidate {
  first: string;
  last: string;
  party: string[];
  partyId: string;
}

const STRUCTURED_CANDIDATES: StructuredCandidate[] = (() => {
  const candidates: StructuredCandidate[] = [];
  const seen = new Set<string>();
  const uniqueParties = new Map<string, string[]>();

  for (const party of Object.values(lookupRecord)) {
    // Never include test parties in fuzzy matching so real guests with 1-char typos cannot match Penny
    if (isTestPartyNames(party)) continue;
    const partyId = JSON.stringify(party);
    if (!uniqueParties.has(partyId)) {
      uniqueParties.set(partyId, party);
    }
  }

  const reverseAliases = new Map<string, string[]>();
  for (const [alias, canonicals] of Object.entries(firstNameAliases)) {
    if (alias.length < 3) continue;
    for (const canon of canonicals) {
      const list = reverseAliases.get(canon) ?? [];
      if (!list.includes(alias)) list.push(alias);
      reverseAliases.set(canon, list);
    }
  }

  const addCandidate = (first: string, last: string, party: string[], partyId: string) => {
    if (!first || !last) return;
    const dedupKey = `${first}|${last}|${partyId}`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      candidates.push({ first, last, party, partyId });
    }
  };

  for (const [partyId, party] of uniqueParties.entries()) {
    const memberFirsts: string[] = [];
    for (const member of party) {
      const cleaned = stripHonorificTokens(member);
      const tokens = cleaned
        .split(/[\s-]+/)
        .map((t) => normalizeName(t))
        .filter(Boolean);

      if (tokens.length < 2) continue;

      const canonicalFirst = tokens[0];
      memberFirsts.push(canonicalFirst);
      const firstOptions = [
        canonicalFirst,
        ...(reverseAliases.get(canonicalFirst) ?? []),
      ];

      if (tokens.length === 2) {
        const last = tokens[1];
        for (const f of firstOptions) {
          addCandidate(f, last, party, partyId);
        }
      } else if (tokens.length >= 3) {
        const combinedLast = tokens.slice(1).join("");
        const part1 = tokens[1];
        const part2 = tokens.slice(2).join("");
        for (const f of firstOptions) {
          addCandidate(f, combinedLast, party, partyId);
          addCandidate(f, part1, party, partyId);
          addCandidate(f, part2, party, partyId);
          addCandidate(`${f}${part1}`, part2, party, partyId);
        }
      }
    }

    // Also incorporate extra compound lookup keys pointing to this party (e.g. "javiermoragatrujillo")
    for (const [rawKey, keyParty] of Object.entries(lookupRecord)) {
      if (JSON.stringify(keyParty) !== partyId) continue;
      for (const member of party) {
        const memberTokens = stripHonorificTokens(member)
          .split(/[\s-]+/)
          .map((t) => normalizeName(t))
          .filter(Boolean);
        if (memberTokens.length < 2) continue;
        const cf = memberTokens[0];
        const cl = memberTokens.slice(1).join("");
        if (rawKey.startsWith(cf) && rawKey.length > cf.length + 1) {
          const extraLast = rawKey.slice(cf.length);
          const secondSurname =
            extraLast.startsWith(cl) && extraLast.length - cl.length >= 3
              ? extraLast.slice(cl.length)
              : "";
          const firstOptions = [cf, ...(reverseAliases.get(cf) ?? [])];
          for (const f of firstOptions) {
            addCandidate(f, extraLast, party, partyId);
            if (secondSurname) {
              addCandidate(f, secondSurname, party, partyId);
            }
          }
        }
      }
    }
  }

  return candidates;
})();

function isComponentDistanceAllowed(inputPart: string, candPart: string, dist: number): boolean {
  if (dist === 0) return true;
  if (dist > 2) return false;

  const minLen = Math.min(inputPart.length, candPart.length);
  const maxLen = Math.max(inputPart.length, candPart.length);

  if (minLen <= 2) {
    return dist === 1 && maxLen >= 3 && inputPart[0] === candPart[0];
  }

  if (minLen === 3) {
    return dist === 1 && inputPart[0] === candPart[0];
  }

  if (minLen <= 5) {
    if (dist === 1) return true;
    return (
      isAdjacentTransposition(inputPart, candPart) ||
      candPart.startsWith(inputPart) ||
      inputPart.startsWith(candPart)
    );
  }

  return dist <= 2;
}

/**
 * Resolves a guest's party by checking:
 * 1. Exact key match in rsvp_lookup.json (including honorific-stripped fallback)
 * 2. First-name alias / nickname / middle-name expansion
 * 3. Safe Levenshtein fuzzy matching fallback (requiring an unambiguous best party match)
 */
export function findPartyForGuest(first: string, last: string): string[] | null {
  const exactKey = getLookupKey(first, last);
  if (lookupRecord[exactKey]) {
    return lookupRecord[exactKey];
  }

  const strippedFirst = stripHonorificTokens(first);
  const strippedExactKey = getLookupKey(strippedFirst, last);
  if (strippedExactKey && lookupRecord[strippedExactKey]) {
    return lookupRecord[strippedExactKey];
  }

  const normFirst = normalizeName(strippedFirst || first);
  const normLast = normalizeName(last);
  if (!normFirst || !normLast) {
    return null;
  }

  // Step 2: First-name alias & middle-name lookup
  const aliasMatches = new Map<string, string[]>();
  const directAliases = firstNameAliases[normFirst] ?? [];
  for (const altFirst of directAliases) {
    const party = lookupRecord[`${altFirst}${normLast}`];
    if (party && !isTestPartyNames(party)) {
      aliasMatches.set(JSON.stringify(party), party);
    }
  }

  const firstTokens = (strippedFirst || first)
    .trim()
    .split(/[\s-]+/)
    .map((t) => normalizeName(t))
    .filter(Boolean);

  if (firstTokens.length > 1) {
    const primaryFirst = firstTokens[0];
    const restFirst = firstTokens.slice(1).join("");
    // Middle-name tolerance: check primary given name + surname (e.g. "Maria Elena" + "Furlan")
    const primaryDirect = lookupRecord[`${primaryFirst}${normLast}`];
    if (primaryDirect && !isTestPartyNames(primaryDirect)) {
      aliasMatches.set(JSON.stringify(primaryDirect), primaryDirect);
    }
    const firstWordAliases = firstNameAliases[primaryFirst] ?? [];
    for (const altFirst of firstWordAliases) {
      const partyCompound = lookupRecord[`${altFirst}${restFirst}${normLast}`];
      if (partyCompound && !isTestPartyNames(partyCompound)) {
        aliasMatches.set(JSON.stringify(partyCompound), partyCompound);
      }
      const partyPrimary = lookupRecord[`${altFirst}${normLast}`];
      if (partyPrimary && !isTestPartyNames(partyPrimary)) {
        aliasMatches.set(JSON.stringify(partyPrimary), partyPrimary);
      }
    }
  }

  if (aliasMatches.size === 1) {
    return Array.from(aliasMatches.values())[0];
  }
  if (aliasMatches.size > 1) {
    return null;
  }

  // Step 3: Structured candidate + Levenshtein fuzzy matching fallback
  const firstVariants = [normFirst, ...directAliases];
  if (firstTokens.length > 1) {
    const primaryFirst = firstTokens[0];
    if (!firstVariants.includes(primaryFirst)) {
      firstVariants.push(primaryFirst);
    }
    const firstWordAliases = firstNameAliases[primaryFirst] ?? [];
    const restFirst = firstTokens.slice(1).join("");
    for (const altFirst of firstWordAliases) {
      for (const candidateVariant of [`${altFirst}${restFirst}`, altFirst]) {
        if (!firstVariants.includes(candidateVariant)) {
          firstVariants.push(candidateVariant);
        }
      }
    }
  }

  let bestTotalDist = Infinity;
  let bestPartyMatches = new Map<string, string[]>();

  for (const cand of STRUCTURED_CANDIDATES) {
    const lastDist = levenshteinDistance(normLast, cand.last);
    if (!isComponentDistanceAllowed(normLast, cand.last, lastDist)) {
      continue;
    }

    for (const f of firstVariants) {
      const firstDist = levenshteinDistance(f, cand.first);
      if (!isComponentDistanceAllowed(f, cand.first, firstDist)) {
        continue;
      }

      const totalDist = firstDist + lastDist;
      if (totalDist > 2) {
        continue;
      }

      if (firstDist > 0 && lastDist > 0 && (f.length < 4 || normLast.length < 4)) {
        continue;
      }

      if (totalDist < bestTotalDist) {
        bestTotalDist = totalDist;
        bestPartyMatches = new Map([[cand.partyId, cand.party]]);
      } else if (totalDist === bestTotalDist) {
        bestPartyMatches.set(cand.partyId, cand.party);
      }
    }
  }

  if (bestPartyMatches.size === 1) {
    return Array.from(bestPartyMatches.values())[0];
  }

  return null;
}

/**
 * Resolves which specific canonical member of a party matches the given first and last name.
 */
export function resolvePartyMember(first: string, last: string, party: string[]): string | null {
  if (!Array.isArray(party) || party.length === 0) return null;
  if (party.length === 1) return party[0];

  const exactFullKey = getLookupKey(first, last);
  const exactFullMatch = party.find((m) => normalizeName(m) === exactFullKey);
  if (exactFullMatch) return exactFullMatch;

  const strippedFirst = stripHonorificTokens(first);
  const normFirst = normalizeName(strippedFirst || first);
  const normLast = normalizeName(last);
  if (!normFirst) return null;

  const firstVariants = new Set<string>([
    normFirst,
    normalizeName(first),
    ...(firstNameAliases[normFirst] ?? []),
  ]);

  const firstTokens = (strippedFirst || first)
    .trim()
    .split(/[\s-]+/)
    .map((t) => normalizeName(t))
    .filter(Boolean);
  if (firstTokens.length > 0) {
    const firstWord = firstTokens[0];
    firstVariants.add(firstWord);
    for (const alt of firstNameAliases[firstWord] ?? []) {
      firstVariants.add(alt);
      if (firstTokens.length > 1) {
        firstVariants.add(`${alt}${firstTokens.slice(1).join("")}`);
      }
    }
  }

  let bestMember: string | null = null;
  let bestScore = Infinity;
  let bestFirstDist = Infinity;

  for (const member of party) {
    const tokens = member
      .split(/[\s-]+/)
      .map((t) => normalizeName(t))
      .filter(Boolean);
    if (tokens.length === 0) continue;

    const candPairs: Array<[string, string]> = [];
    if (tokens.length === 1) {
      candPairs.push([tokens[0], ""]);
    } else if (tokens.length === 2) {
      candPairs.push([tokens[0], tokens[1]]);
    } else {
      const combinedLast = tokens.slice(1).join("");
      const part1 = tokens[1];
      const part2 = tokens.slice(2).join("");
      candPairs.push([tokens[0], combinedLast]);
      candPairs.push([tokens[0], part1]);
      candPairs.push([tokens[0], part2]);
      candPairs.push([`${tokens[0]}${part1}`, part2]);
    }

    for (const [cFirst, cLast] of candPairs) {
      const lastDist = normLast && cLast ? levenshteinDistance(normLast, cLast) : 0;
      for (const fVar of firstVariants) {
        if (!fVar) continue;
        const firstDist = levenshteinDistance(fVar, cFirst);
        const score = firstDist * 3 + Math.min(lastDist, 3);
        if (score < bestScore || (score === bestScore && firstDist < bestFirstDist)) {
          bestScore = score;
          bestFirstDist = firstDist;
          bestMember = member;
        }
      }
    }
  }

  if (bestMember && bestFirstDist <= 2) {
    return bestMember;
  }

  return null;
}

export function resolveSubmittedBy(rawInput: string, party: string[]): string | undefined {
  const trimmed = rawInput.trim();
  if (!trimmed) return undefined;

  const cleanParty = party.map((p) => p.trim()).filter(Boolean);
  if (cleanParty.length === 0) return trimmed;

  const normInput = normalizeName(trimmed);
  if (!normInput) return trimmed;

  const exactMatch = cleanParty.find((m) => normalizeName(m) === normInput);
  if (exactMatch) return exactMatch;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const matchedSingle = resolvePartyMember(parts[0], "", cleanParty);
    if (matchedSingle) return matchedSingle;
    return trimmed;
  }

  const matchedFirstSplit = resolvePartyMember(parts[0], parts.slice(1).join(" "), cleanParty);
  if (matchedFirstSplit) return matchedFirstSplit;

  if (parts.length >= 3) {
    const matchedLastSplit = resolvePartyMember(
      parts.slice(0, -1).join(" "),
      parts[parts.length - 1],
      cleanParty
    );
    if (matchedLastSplit) return matchedLastSplit;
  }

  return trimmed;
}

/**
 * Handles guest party lookup queries:
 * GET /?first=...&last=... or GET /lookup?first=...&last=...
 */
export function handleLookup(
  url: URL,
  env: Env,
  ctx: ExecutionContext | undefined,
  corsHeaders: Record<string, string>
): Response {
  const first = url.searchParams.get("first")?.trim();
  const last = url.searchParams.get("last")?.trim();

  if (!first || !last) {
    return new Response(JSON.stringify({ error: "Missing name query parameters" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  const party = findPartyForGuest(first, last);

  if (!party) {
    console.warn(
      JSON.stringify({
        event: "rsvp_lookup_not_found",
        first: first.slice(0, 100),
        last: last.slice(0, 100),
      })
    );
    if (ctx) {
      ctx.waitUntil(recordLookupMiss(env, first, last));
    }
    return new Response(JSON.stringify({ error: "Guest not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  const matchedGuest = resolvePartyMember(first, last, party);
  const delight = resolveGuestDelight({
    party,
    matchedGuest,
    first,
    last,
  });

  return new Response(JSON.stringify(party), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // URI-encode X-Matched-Guest so non-ASCII characters (accents, curly apostrophes) never throw ByteString 500s
      ...(matchedGuest ? { "X-Matched-Guest": encodeURIComponent(matchedGuest) } : {}),
      ...(delight ? { "X-Rsvp-Delight": encodeDelightHeader(delight) } : {}),
      ...corsHeaders,
    },
  });
}

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidDeliverableEmail(email: string | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (/[\r\n<>,;\s]/.test(trimmed)) return false;
  return STRICT_EMAIL_REGEX.test(trimmed);
}

function parseEmailList(raw: string | undefined): string[] {
  if (!raw) return [];
  const results: string[] = [];
  for (const part of raw.split(/[,;]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const angleMatch = trimmed.match(/<([^>]+)>/);
    const bare = (angleMatch ? angleMatch[1] : trimmed).trim();
    if (isValidDeliverableEmail(bare) && !results.includes(bare)) {
      results.push(bare);
    }
  }
  return results;
}

/**
 * Parses an explicit attendance value into boolean, returning `null` if omitted/unrecognized.
 */
function parseExplicitAttendingValue(val: unknown): boolean | null {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (val === undefined || val === null) return null;
  const str = String(val).toLowerCase().trim();
  if (!str) return null;
  if (
    str.includes("decline") ||
    str.includes("regret") ||
    str.includes("no podre") ||
    str.includes("no voy") ||
    str === "false" ||
    str === "0" ||
    str === "no"
  ) {
    return false;
  }
  if (
    str.includes("accept") ||
    str.includes("joyful") ||
    str.includes("confirmo") ||
    str.includes("asistir") ||
    str === "true" ||
    str === "1" ||
    str === "yes" ||
    str === "si" ||
    str === "sí"
  ) {
    return true;
  }
  return null;
}

/**
 * Extracts and normalizes party members, attendance statuses, dietary notes,
 * and guest email from either JSON or FormData submissions.
 */
export function extractSubmissionPayload(raw: Record<string, unknown>): RsvpSubmissionPayload {
  const rawDietary = (
    raw.dietary ||
    raw.message ||
    raw.notes ||
    raw.dietary_restrictions ||
    raw.dietaryRestrictions ||
    ""
  ) as string;

  const rawEmail = (
    raw.email ||
    raw.guest_email ||
    raw.guestEmail ||
    ""
  ) as string;

  const partyList: GuestResponse[] = [];

  // Case 1: raw.party is an array of structured objects (preferred JSON contract)
  if (Array.isArray(raw.party)) {
    for (const item of raw.party) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const name = String(obj.name || obj.guest || "").trim();
        if (!name) continue;
        const explicit =
          obj.attending !== undefined
            ? parseExplicitAttendingValue(obj.attending)
            : parseExplicitAttendingValue(obj.status);
        if (explicit === null) {
          throw new Error(`Missing attendance selection for ${name}`);
        }
        partyList.push({
          name,
          status: explicit ? "Joyfully Accept" : "Regretfully Decline",
          attending: explicit,
        });
      }
    }
  }

  // Case 2: raw.responses is a map: { "Guest Name": "Joyfully Accept" }
  if (
    partyList.length === 0 &&
    raw.responses &&
    typeof raw.responses === "object" &&
    !Array.isArray(raw.responses)
  ) {
    for (const [name, val] of Object.entries(raw.responses as Record<string, unknown>)) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;
      const explicit = parseExplicitAttendingValue(val);
      if (explicit === null) {
        throw new Error(`Missing attendance selection for ${trimmedName}`);
      }
      partyList.push({
        name: trimmedName,
        status: explicit ? "Joyfully Accept" : "Regretfully Decline",
        attending: explicit,
      });
    }
  }

  // Case 3: Indexed form fields (`guest_name_0` + `attending_0`) or legacy `party_members`
  if (partyList.length === 0) {
    const indexedEntries: Array<{ idx: number; name: string; val: unknown }> = [];
    for (const [k, v] of Object.entries(raw)) {
      const match = k.match(/^guest_name_(\d+)$/);
      if (match) {
        const idx = Number(match[1]);
        const name = String(v || "").trim();
        if (name) {
          indexedEntries.push({ idx, name, val: raw[`attending_${idx}`] });
        }
      }
    }
    if (indexedEntries.length > 0) {
      indexedEntries.sort((a, b) => a.idx - b.idx);
      for (const entry of indexedEntries) {
        const explicit = parseExplicitAttendingValue(entry.val);
        if (explicit === null) {
          throw new Error(`Missing attendance selection for ${entry.name}`);
        }
        partyList.push({
          name: entry.name,
          status: explicit ? "Joyfully Accept" : "Regretfully Decline",
          attending: explicit,
        });
      }
    }
  }

  // Case 4: Legacy FormData fallback (`party_members` + `attending_<sanitized>`)
  if (
    partyList.length === 0 &&
    typeof raw.party_members === "string" &&
    raw.party_members.trim().length > 0
  ) {
    const names = raw.party_members
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    names.forEach((name, idx) => {
      const sanitized = name.replace(/[^a-zA-Z0-9]/g, "_");
      const val =
        raw[`attending_${idx}`] ??
        raw[`attending_${sanitized}`] ??
        raw[`attending_${name}`];
      const explicit = parseExplicitAttendingValue(val);
      if (explicit === null) {
        throw new Error(`Missing attendance selection for ${name}`);
      }
      partyList.push({
        name,
        status: explicit ? "Joyfully Accept" : "Regretfully Decline",
        attending: explicit,
      });
    });
  }

  const rawSubmittedBy = (
    raw.submitted_by ||
    raw.submittedBy ||
    raw.submitter ||
    (typeof raw.first_name === "string" && typeof raw.last_name === "string"
      ? `${raw.first_name.trim()} ${raw.last_name.trim()}`
      : "") ||
    (typeof raw.firstName === "string" && typeof raw.lastName === "string"
      ? `${raw.firstName.trim()} ${raw.lastName.trim()}`
      : "") ||
    ""
  ) as string;

  const submittedBy =
    typeof rawSubmittedBy === "string" && rawSubmittedBy.trim().length > 0
      ? resolveSubmittedBy(
          rawSubmittedBy,
          partyList.map((p) => p.name)
        )
      : undefined;

  const rawLang = typeof raw.lang === "string" ? raw.lang.trim().toLowerCase() : "";
  const lang: "en" | "es" = rawLang === "es" ? "es" : "en";

  // Security: NEVER accept caller-supplied `personal_note` — resolve strictly server-side from delights config
  const personalNote = resolveEmailNoteForSubmission({
    party: partyList,
    submittedBy,
    lang,
  });

  const KNOWN_KEYS = new Set([
    "_next",
    "lang",
    "party",
    "party_members",
    "partyMembers",
    "responses",
    "submitted_by",
    "submittedBy",
    "submitter",
    "first_name",
    "last_name",
    "firstName",
    "lastName",
    "email",
    "guest_email",
    "guestEmail",
    "dietary",
    "message",
    "notes",
    "dietary_restrictions",
    "dietaryRestrictions",
    "personal_note",
    "personalNote",
    "extras",
  ]);

  const extras: Record<string, string> = {};
  if (raw.extras && typeof raw.extras === "object" && !Array.isArray(raw.extras)) {
    for (const [k, v] of Object.entries(raw.extras as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      const strVal = String(v).trim().slice(0, MAX_EXTRA_VALUE_LENGTH);
      if (strVal) extras[k.slice(0, 80)] = strVal.toLowerCase() === "on" ? "Yes" : strVal;
    }
  }
  for (const [key, rawVal] of Object.entries(raw)) {
    if (
      KNOWN_KEYS.has(key) ||
      key.startsWith("attending_") ||
      key.startsWith("guest_name_")
    ) {
      continue;
    }
    if (rawVal === undefined || rawVal === null) continue;
    const strVal = String(rawVal).trim().slice(0, MAX_EXTRA_VALUE_LENGTH);
    if (!strVal) continue;
    extras[key.slice(0, 80)] = strVal.toLowerCase() === "on" ? "Yes" : strVal;
  }

  const cleanEmail =
    typeof rawEmail === "string" && rawEmail.trim().length > 0
      ? rawEmail.trim().slice(0, 254)
      : undefined;
  const emailValid = cleanEmail ? isValidDeliverableEmail(cleanEmail) : undefined;
  const cleanDietary =
    typeof rawDietary === "string" && rawDietary.trim().length > 0
      ? rawDietary.trim().slice(0, MAX_DIETARY_LENGTH)
      : undefined;

  return {
    id: crypto.randomUUID(),
    partyKey: computePartyKey(partyList),
    party: partyList,
    ...(submittedBy ? { submittedBy } : {}),
    dietary: cleanDietary,
    email: cleanEmail,
    ...(emailValid !== undefined ? { emailValid } : {}),
    lang,
    ...(personalNote ? { personalNote } : {}),
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Validates that the submitted party matches an actual invited party in `rsvp_lookup.json`
 * and canonicalizes each member's display name.
 */
function validateAndCanonicalizeParty(submission: RsvpSubmissionPayload): RsvpSubmissionPayload {
  const partyKey = submission.partyKey || computePartyKey(submission.party);
  const canonicalParty = canonicalPartiesByKey.get(partyKey);

  if (!canonicalParty) {
    throw new Error("Submitted party does not match an invited party.");
  }

  if (submission.party.length !== canonicalParty.length) {
    throw new Error("Please select an attendance response for every member of your party.");
  }

  const usedIndices = new Set<number>();
  const canonicalResponses: GuestResponse[] = canonicalParty.map((canonName) => {
    const normCanon = normalizeName(canonName);
    const matchIdx = submission.party.findIndex(
      (g, idx) => !usedIndices.has(idx) && normalizeName(g.name) === normCanon
    );
    if (matchIdx === -1) {
      throw new Error(`Missing response for party member ${canonName}`);
    }
    usedIndices.add(matchIdx);
    const matched = submission.party[matchIdx];
    return {
      name: canonName,
      status: matched.attending ? "Joyfully Accept" : "Regretfully Decline",
      attending: matched.attending,
    };
  });

  const canonicalSubmittedBy = submission.submittedBy
    ? resolveSubmittedBy(submission.submittedBy, canonicalParty)
    : undefined;

  const personalNote = resolveEmailNoteForSubmission({
    party: canonicalResponses,
    submittedBy: canonicalSubmittedBy,
    lang: submission.lang,
  });

  return {
    ...submission,
    partyKey,
    party: canonicalResponses,
    ...(canonicalSubmittedBy ? { submittedBy: canonicalSubmittedBy } : {}),
    ...(personalNote ? { personalNote } : {}),
  };
}

async function parseRsvpBody(request: Request): Promise<RsvpSubmissionPayload> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    throw new Error("Submission payload is too large.");
  }

  const contentType = request.headers.get("content-type") || "";
  let raw: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_BYTES) {
      throw new Error("Submission payload is too large.");
    }
    try {
      raw = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid JSON body");
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    for (const [key, val] of formData.entries()) {
      if (typeof val === "string") {
        raw[key] = val;
      }
    }
  } else {
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_BYTES) {
      throw new Error("Submission payload is too large.");
    }
    try {
      raw = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      throw new Error("Unsupported Content-Type. Please send JSON or Form Data.");
    }
  }

  const extracted = extractSubmissionPayload(raw);
  return validateAndCanonicalizeParty(extracted);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendResendWithRetry(options: {
  apiKey: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  logContext: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<{ success: boolean; status?: number; error?: string }> {
  const maxAttempts = options.maxAttempts ?? 3;
  let lastError = "Unknown email send error";
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        body: JSON.stringify(options.payload),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });

      lastStatus = response.status;

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        console.log(
          JSON.stringify({
            ...options.logContext,
            attempt,
            resendId: data?.id,
          })
        );
        return { success: true, status: response.status };
      }

      const errText = (await response.text()).slice(0, 1000);
      lastError = `Resend error (${response.status}): ${errText}`;

      // Do not retry non-transient 4xx errors (except 429 rate-limit / 408 timeout)
      const isRetryable =
        response.status === 429 || response.status === 408 || response.status >= 500;
      if (!isRetryable || attempt === maxAttempts) {
        console.error(
          JSON.stringify({
            event: "resend_api_error",
            ...options.logContext,
            attempt,
            status: response.status,
            body: errText,
          })
        );
        return { success: false, status: response.status, error: lastError };
      }

      const retryAfterSec = Number(response.headers.get("retry-after") || "0");
      const baseDelayMs = retryAfterSec > 0 && retryAfterSec <= 5
        ? retryAfterSec * 1000
        : attempt * 650 + Math.floor(Math.random() * 250);
      await sleep(baseDelayMs);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) {
        console.error(
          JSON.stringify({
            event: "resend_fetch_exception",
            ...options.logContext,
            attempt,
            error: lastError,
          })
        );
        return { success: false, error: lastError };
      }
      await sleep(attempt * 600 + Math.floor(Math.random() * 200));
    }
  }

  return { success: false, status: lastStatus, error: lastError };
}

/**
 * Sends a confirmation email to the guest via Resend API
 */
async function sendConfirmationEmail(
  submission: RsvpSubmissionPayload,
  apiKey: string,
  replyToConfig?: string
): Promise<{ success: boolean; error?: string }> {
  if (!submission.email) {
    return { success: false, error: "No recipient email provided" };
  }
  if (!isValidDeliverableEmail(submission.email)) {
    return { success: false, error: "Guest email format is invalid; confirmation skipped" };
  }

  const html = buildConfirmationEmailHtml(submission);
  const text = buildConfirmationEmailText(submission);
  const subject = getConfirmationEmailSubject(submission);
  const hostReplyTos = parseEmailList(replyToConfig);

  const payload: Record<string, unknown> = {
    from: "Lianne & Lucas <rsvp@send.lucasandlianne.com>",
    ...(hostReplyTos.length === 1
      ? { reply_to: `Lianne & Lucas <${hostReplyTos[0]}>` }
      : hostReplyTos.length > 1
      ? { reply_to: hostReplyTos }
      : {}),
    to: [submission.email.trim()],
    subject,
    html,
    text,
  };

  return sendResendWithRetry({
    apiKey,
    payload,
    idempotencyKey: submission.id ? `guest-confirm-${submission.id}` : undefined,
    logContext: {
      event: "resend_email_sent",
      submissionId: submission.id,
      to: submission.email.trim(),
    },
  });
}

/**
 * Sends a notification email to the hosts via Resend API on every RSVP submission.
 * Decouples `reply_to` validation and automatically falls back without `reply_to` on 422
 * so a malformed guest email can NEVER prevent host notification delivery.
 */
export async function sendHostNotificationEmail(
  submission: RsvpSubmissionPayload,
  apiKey: string,
  recipientConfig?: string,
  idempotencySuffix = ""
): Promise<{ success: boolean; error?: string }> {
  const hostRecipients = parseEmailList(recipientConfig);
  if (hostRecipients.length === 0) {
    console.warn(
      JSON.stringify({
        event: "notification_email_missing",
        message: "NOTIFICATION_EMAIL secret is missing or invalid; host notification skipped",
      })
    );
    return { success: false, error: "NOTIFICATION_EMAIL not configured in worker environment" };
  }

  const html = buildHostNotificationEmailHtml(submission);
  const text = buildHostNotificationEmailText(submission);
  const subject = getHostNotificationEmailSubject(submission);
  const canUseGuestReplyTo = isValidDeliverableEmail(submission.email);

  const basePayload: Record<string, unknown> = {
    from: "Lianne & Lucas RSVP <rsvp@send.lucasandlianne.com>",
    to: hostRecipients,
    subject,
    html,
    text,
  };

  const primaryPayload: Record<string, unknown> = canUseGuestReplyTo
    ? { ...basePayload, reply_to: submission.email!.trim() }
    : basePayload;

  const primaryResult = await sendResendWithRetry({
    apiKey,
    payload: primaryPayload,
    idempotencyKey: submission.id
      ? `host-notify-${submission.id}${idempotencySuffix}`
      : undefined,
    logContext: {
      event: "resend_host_notification_sent",
      submissionId: submission.id,
      to: hostRecipients,
    },
  });

  // Defensive fallback: if Resend rejected `reply_to` with 422 despite regex check, retry immediately without `reply_to`
  if (!primaryResult.success && primaryResult.status === 422 && canUseGuestReplyTo) {
    return sendResendWithRetry({
      apiKey,
      payload: basePayload,
      idempotencyKey: submission.id
        ? `host-notify-noreplyto-${submission.id}${idempotencySuffix}`
        : undefined,
      logContext: {
        event: "resend_host_notification_sent_fallback",
        submissionId: submission.id,
        to: hostRecipients,
      },
    });
  }

  return primaryResult;
}

/**
 * Handles RSVP submission:
 * POST /submit (or POST /rsvp)
 */
export async function handleRsvpSubmit(
  request: Request,
  env: Env,
  ctx: ExecutionContext | undefined,
  corsHeaders: Record<string, string>
): Promise<Response> {
  let submission: RsvpSubmissionPayload;
  try {
    submission = await parseRsvpBody(request);
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Invalid RSVP submission",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  if (submission.party.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing RSVP party responses" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  const isPennyTestParty = isTestPartyNames(submission.party.map((g) => g.name));
  submission.isTest = isPennyTestParty;

  // Complete structured log (including dietary & email so Worker Logs serve as a 3rd recovery layer)
  console.log(
    JSON.stringify({
      event: "rsvp_submission_received",
      submissionId: submission.id,
      partyKey: submission.partyKey,
      submittedBy: submission.submittedBy ?? null,
      partyCount: submission.party.length,
      party: submission.party,
      dietary: submission.dietary ?? null,
      email: submission.email ?? null,
      emailValid: submission.emailValid ?? null,
      lang: submission.lang ?? "en",
      extras: submission.extras ?? null,
      isTest: isPennyTestParty,
      submittedAt: submission.submittedAt,
    })
  );

  // 1. Write-ahead persistence to Cloudflare D1 / KV BEFORE external network calls
  const persistOutcome = await persistRsvpSubmission(env, submission, {
    isTest: isPennyTestParty,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  const apiKey = env.RESEND_API_KEY;
  let notificationSent = false;
  let notificationError: string | undefined;

  if (isPennyTestParty) {
    console.log(
      JSON.stringify({
        event: "host_notification_skipped_test_party",
        submissionId: submission.id,
        party: submission.party.map((g) => g.name),
      })
    );
  } else if (apiKey) {
    const notifyResult = await sendHostNotificationEmail(
      submission,
      apiKey,
      env.NOTIFICATION_EMAIL
    );
    notificationSent = notifyResult.success;
    if (!notifyResult.success) {
      notificationError = notifyResult.error;
    }
  } else {
    console.warn(
      JSON.stringify({
        event: "resend_api_key_missing",
        submissionId: submission.id,
        message: "RESEND_API_KEY secret is not configured; host notification skipped",
      })
    );
    notificationError = "RESEND_API_KEY not configured in worker environment";
  }

  let emailSent: boolean | undefined;
  let emailError: string | undefined;

  if (submission.email) {
    const canSendTestConfirm = !isPennyTestParty || allowTestPartyConfirmationEmail();

    if (!canSendTestConfirm) {
      emailSent = false;
      emailError = "Test party confirmation rate limit reached; try again in a few minutes";
    } else if (apiKey) {
      // Pace slightly after host notification to respect Resend's 2 req/sec rate limit
      if (!isPennyTestParty) {
        await sleep(350);
      }
      const result = await sendConfirmationEmail(submission, apiKey, env.NOTIFICATION_EMAIL);
      emailSent = result.success;
      if (!result.success) {
        emailError = result.error;
      }
    } else {
      emailSent = false;
      emailError = "RESEND_API_KEY not configured in worker environment";
    }
  }

  // Update delivery status in D1 / KV asynchronously
  if (persistOutcome.persisted) {
    const updatePromise = updateDeliveryStatus(env, persistOutcome.record, {
      notificationSent,
      notificationError,
      notificationAttempts: isPennyTestParty ? 0 : 1,
      confirmationSent: emailSent,
      confirmationError: emailError,
    });
    if (ctx) {
      ctx.waitUntil(updatePromise);
    } else {
      await updatePromise;
    }
  }

  // Zero-Lost-RSVP Guarantee: NEVER return 200 OK if a real RSVP was neither persisted nor emailed to hosts!
  if (!isPennyTestParty && !persistOutcome.persisted && !notificationSent) {
    console.error(
      JSON.stringify({
        event: "rsvp_critical_unrecorded_failure",
        submissionId: submission.id,
        notificationError,
      })
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "We couldn't save your RSVP right now. Please try submitting again in a moment.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  const responsePayload: SubmitResult = {
    success: true,
    submissionId: submission.id,
    persisted: persistOutcome.persisted,
    message: "RSVP received successfully",
    party: submission.party,
    notificationSent,
    ...(notificationError ? { notificationError } : {}),
    ...(submission.email ? { emailSent, ...(emailError ? { emailError } : {}) } : {}),
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function verifyAdminToken(request: Request, expectedToken: string | undefined): Promise<boolean> {
  if (!expectedToken || !expectedToken.trim()) return false;
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const encoder = new TextEncoder();
  const [aDigest, bDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(match[1].trim())),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken.trim())),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(aDigest, bDigest);
  }
  const aBytes = new Uint8Array(aDigest);
  const bBytes = new Uint8Array(bDigest);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function handleAdminExport(
  request: Request,
  url: URL,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const authorized = await verifyAdminToken(request, env.ADMIN_API_TOKEN);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { latestByParty, allSubmissions } = await exportAllRsvps(env);
  const format = url.searchParams.get("format")?.toLowerCase();

  if (format === "csv") {
    const scope = url.searchParams.get("scope") === "all" ? allSubmissions : latestByParty;
    const csv = formatRsvpsAsCsv(scope);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wedding-rsvps-${new Date().toISOString().slice(0, 10)}.csv"`,
        ...corsHeaders,
      },
    });
  }

  return new Response(
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      partyCount: latestByParty.length,
      totalSubmissions: allSubmissions.length,
      latestByParty,
      allSubmissions,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "GET") {
        if (pathname === "/" || pathname === "/lookup" || pathname === "/api/lookup") {
          return handleLookup(url, env, ctx, corsHeaders);
        }
        if (pathname === "/health" || pathname === "/ping") {
          return new Response(
            JSON.stringify({
              status: "ok",
              hasKv: Boolean(env.RSVP_KV),
              hasD1: Boolean(env.RSVP_DB),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }
        if (pathname === "/admin/rsvps") {
          return await handleAdminExport(request, url, env, corsHeaders);
        }
      }

      if (request.method === "POST") {
        if (
          pathname === "/submit" ||
          pathname === "/api/submit" ||
          pathname === "/rsvp" ||
          pathname === "/"
        ) {
          return await handleRsvpSubmit(request, env, ctx, corsHeaders);
        }
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "unhandled_error",
          error: err instanceof Error ? err.stack || err.message : String(err),
        })
      );
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },

  /**
   * Scheduled Cron Trigger (runs every 10 minutes):
   * Sweeps any persisted RSVPs whose host notification email failed (e.g. Resend 429 / outage)
   * and retries delivering them until confirmed sent.
   */
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL) return;

    const pending = await listPendingHostNotifications(env, 10);
    for (const record of pending) {
      const attemptNum = record.notificationAttempts + 1;
      const result = await sendHostNotificationEmail(
        record.submission,
        env.RESEND_API_KEY,
        env.NOTIFICATION_EMAIL,
        `-cron-${attemptNum}`
      );
      await updateDeliveryStatus(env, record, {
        notificationSent: result.success,
        notificationError: result.error,
        notificationAttempts: attemptNum,
      });
      await sleep(600);
    }
  },
} satisfies ExportedHandler<Env>;
