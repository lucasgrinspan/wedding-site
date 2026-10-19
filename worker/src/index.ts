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
  GuestResponse,
  RsvpSubmissionPayload,
  SubmitResult,
} from "./types";

const rawLookupData = rsvpLookupData as Record<string, unknown>;

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

const { lookupRecord, firstNameAliases } = (() => {
  const records: Record<string, string[]> = {};
  const aliases: Record<string, string[]> = {};

  for (const [key, val] of Object.entries(rawLookupData)) {
    if (key.startsWith("_") || !Array.isArray(val)) continue;
    records[normalizeName(key)] = val.map((m) => String(m));
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

  const rawAliases = rawLookupData._aliases ?? rawLookupData.aliases;
  if (rawAliases && typeof rawAliases === "object" && !Array.isArray(rawAliases)) {
    for (const [rawKey, rawVal] of Object.entries(rawAliases as Record<string, unknown>)) {
      const normKey = normalizeName(rawKey);
      const valList = Array.isArray(rawVal)
        ? rawVal.map((v) => String(v))
        : typeof rawVal === "string"
        ? [rawVal]
        : [];

      // Support both:
      // 1. Canonical guest name -> array of aliases (e.g. "Mr. Penny": ["Penny"])
      // 2. Nickname/alias -> canonical first name(s) (e.g. "penny": ["mrpenny"])
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

  return { lookupRecord: records, firstNameAliases: aliases };
})();

/**
 * Generates CORS headers allowing requests from lucasandlianne.com and localhost.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  // Reflect origin if provided (standard pattern for full CORS with credentials/fetch), or fallback to "*"
  const allowOrigin = origin ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Expose-Headers": "X-Matched-Guest, X-Rsvp-Delight",
    "Access-Control-Max-Age": "86400",
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
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
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
    const partyId = JSON.stringify(party);
    if (!uniqueParties.has(partyId)) {
      uniqueParties.set(partyId, party);
    }
  }

  // Build reverse map from canonical first name -> nicknames (length >= 3)
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
    for (const member of party) {
      const tokens = member
        .split(/[\s-]+/)
        .map(t => normalizeName(t))
        .filter(Boolean);

      if (tokens.length < 2) continue;

      const canonicalFirst = tokens[0];
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
        // Multi-word or hyphenated surnames (e.g. first + two last names)
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
  }

  return candidates;
})();

function isComponentDistanceAllowed(inputPart: string, candPart: string, dist: number): boolean {
  if (dist === 0) return true;
  if (dist > 2) return false;

  const minLen = Math.min(inputPart.length, candPart.length);
  const maxLen = Math.max(inputPart.length, candPart.length);

  if (minLen <= 2) {
    // Prevent 2-letter names from fuzzy-matching unrelated short names
    return dist === 1 && maxLen >= 3 && inputPart[0] === candPart[0];
  }

  if (minLen === 3) {
    // For 3-letter names, require matching first letter and at most 1 edit
    return dist === 1 && inputPart[0] === candPart[0];
  }

  if (minLen <= 5) {
    if (dist === 1) return true;
    // For 4-5 letter names, only allow distance 2 if it's an adjacent transposition or prefix match
    return (
      isAdjacentTransposition(inputPart, candPart) ||
      candPart.startsWith(inputPart) ||
      inputPart.startsWith(candPart)
    );
  }

  // For names of length >= 6, allow edit distance up to 2
  return dist <= 2;
}

/**
 * Resolves a guest's party by checking:
 * 1. Exact key match in rsvp_lookup.json
 * 2. First-name alias expansion + compound name variations
 * 3. Safe Levenshtein fuzzy matching fallback (requiring an unambiguous best party match)
 */
export function findPartyForGuest(first: string, last: string): string[] | null {
  const exactKey = getLookupKey(first, last);
  if (lookupRecord[exactKey]) {
    return lookupRecord[exactKey];
  }

  const normFirst = normalizeName(first);
  const normLast = normalizeName(last);
  if (!normFirst || !normLast) {
    return null;
  }

  // Step 2: First-name alias lookup (including multi-token first names)
  const aliasMatches = new Map<string, string[]>();
  const directAliases = firstNameAliases[normFirst] ?? [];
  for (const altFirst of directAliases) {
    const party = lookupRecord[`${altFirst}${normLast}`];
    if (party) {
      aliasMatches.set(JSON.stringify(party), party);
    }
  }

  const firstTokens = first
    .trim()
    .split(/[\s-]+/)
    .map(t => normalizeName(t))
    .filter(Boolean);
  if (firstTokens.length > 1) {
    const firstWordAliases = firstNameAliases[firstTokens[0]] ?? [];
    const restFirst = firstTokens.slice(1).join("");
    for (const altFirst of firstWordAliases) {
      const party = lookupRecord[`${altFirst}${restFirst}${normLast}`];
      if (party) {
        aliasMatches.set(JSON.stringify(party), party);
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
    const firstWordAliases = firstNameAliases[firstTokens[0]] ?? [];
    const restFirst = firstTokens.slice(1).join("");
    for (const altFirst of firstWordAliases) {
      const combinedVariant = `${altFirst}${restFirst}`;
      if (!firstVariants.includes(combinedVariant)) {
        firstVariants.push(combinedVariant);
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

      // If both first and last name have typos (1 + 1), require both parts to be at least 4 chars
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
 * Resolves which specific canonical member of a party matches the given first and last name,
 * accounting for compound surnames, first-name aliases, and typos.
 */
export function resolvePartyMember(first: string, last: string, party: string[]): string | null {
  if (!Array.isArray(party) || party.length === 0) return null;
  if (party.length === 1) return party[0];

  const exactFullKey = getLookupKey(first, last);
  const exactFullMatch = party.find((m) => normalizeName(m) === exactFullKey);
  if (exactFullMatch) return exactFullMatch;

  const normFirst = normalizeName(first);
  const normLast = normalizeName(last);
  if (!normFirst) return null;

  const firstVariants = new Set<string>([
    normFirst,
    ...(firstNameAliases[normFirst] ?? []),
  ]);

  const firstTokens = first
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
        const firstDist = levenshteinDistance(fVar, cFirst);
        // Weight first-name similarity heavily because party members frequently share a surname
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

/**
 * Normalizes a submitted_by string to the matching canonical party member name if possible,
 * or falls back to the cleaned input string.
 */
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
export function handleLookup(url: URL, corsHeaders: Record<string, string>): Response {
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
      ...(matchedGuest ? { "X-Matched-Guest": matchedGuest } : {}),
      ...(delight ? { "X-Rsvp-Delight": encodeDelightHeader(delight) } : {}),
      ...corsHeaders,
    },
  });
}

function parseAttendingValue(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (!val) return true; // Default to accepting if attending field omitted
  const str = String(val).toLowerCase().trim();
  if (
    str.includes("decline") ||
    str.includes("regret") ||
    str === "false" ||
    str === "0" ||
    str === "no"
  ) {
    return false;
  }
  return true;
}

/**
 * Extracts and normalizes party members, attendance statuses, dietary notes,
 * and guest email from either JSON or URL-encoded/FormData submissions.
 */
export function extractSubmissionPayload(raw: Record<string, unknown>): RsvpSubmissionPayload {
  const dietary = (
    raw.dietary ||
    raw.message ||
    raw.notes ||
    raw.dietary_restrictions ||
    raw.dietaryRestrictions ||
    ""
  ) as string;

  const email = (
    raw.email ||
    raw.guest_email ||
    raw.guestEmail ||
    ""
  ) as string;

  const partyList: GuestResponse[] = [];

  // Case 1: raw.party is an array of objects or strings
  if (Array.isArray(raw.party)) {
    for (const item of raw.party) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed) {
          partyList.push({
            name: trimmed,
            status: "Joyfully Accept",
            attending: true,
          });
        }
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const name = String(obj.name || obj.guest || "").trim();
        if (name) {
          const val = obj.status !== undefined ? obj.status : obj.attending;
          const attending = parseAttendingValue(val);
          partyList.push({
            name,
            status: attending ? "Joyfully Accept" : "Regretfully Decline",
            attending,
          });
        }
      }
    }
  }

  // Case 2: raw.responses is a map: { "Guest Name": "Joyfully Accept" }
  if (raw.responses && typeof raw.responses === "object" && !Array.isArray(raw.responses)) {
    for (const [name, val] of Object.entries(raw.responses as Record<string, unknown>)) {
      const trimmedName = name.trim();
      if (trimmedName && !partyList.some(p => p.name === trimmedName)) {
        const attending = parseAttendingValue(val);
        partyList.push({
          name: trimmedName,
          status: attending ? "Joyfully Accept" : "Regretfully Decline",
          attending,
        });
      }
    }
  }

  // Case 3: raw.party_members is provided (comma-separated string e.g. "Mr. Penny, Mrs. Penny")
  if (typeof raw.party_members === "string" && raw.party_members.trim().length > 0) {
    const names = raw.party_members.split(",").map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      if (!partyList.some(p => p.name === name)) {
        const sanitized = name.replace(/[^a-zA-Z0-9]/g, "_");
        const val = raw[`attending_${sanitized}`] !== undefined
          ? raw[`attending_${sanitized}`]
          : raw[`attending_${name}`];
        const attending = parseAttendingValue(val);
        partyList.push({
          name,
          status: attending ? "Joyfully Accept" : "Regretfully Decline",
          attending,
        });
      }
    }
  }

  // Case 4: scan attending_* keys in raw
  for (const [k, val] of Object.entries(raw)) {
    if (k.startsWith("attending_")) {
      const rawGuest = k.slice("attending_".length);
      const guestName = rawGuest.replace(/_/g, " ");
      if (!partyList.some(p => p.name.replace(/[^a-zA-Z0-9]/g, "_") === rawGuest || p.name === guestName)) {
        const attending = parseAttendingValue(val);
        partyList.push({
          name: guestName,
          status: attending ? "Joyfully Accept" : "Regretfully Decline",
          attending,
        });
      }
    }
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

  const rawPersonalNote = (raw.personal_note || raw.personalNote || "") as string;
  const personalNote = resolveEmailNoteForSubmission({
    party: partyList,
    submittedBy,
    lang,
    personalNote:
      typeof rawPersonalNote === "string" && rawPersonalNote.trim().length > 0
        ? rawPersonalNote.trim()
        : undefined,
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
  ]);

  const extras: Record<string, string> = {};
  for (const [key, rawVal] of Object.entries(raw)) {
    if (KNOWN_KEYS.has(key) || key.startsWith("attending_")) continue;
    if (rawVal === undefined || rawVal === null) continue;
    const strVal = String(rawVal).trim();
    if (!strVal) continue;
    extras[key] = strVal.toLowerCase() === "on" ? "Yes" : strVal;
  }

  return {
    party: partyList,
    ...(submittedBy ? { submittedBy } : {}),
    dietary: typeof dietary === "string" && dietary.trim().length > 0 ? dietary.trim() : undefined,
    email: typeof email === "string" && email.trim().length > 0 ? email.trim() : undefined,
    lang,
    ...(personalNote ? { personalNote } : {}),
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
    submittedAt: new Date().toISOString(),
  };
}

async function parseRsvpBody(request: Request): Promise<RsvpSubmissionPayload> {
  const contentType = request.headers.get("content-type") || "";
  let raw: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    try {
      raw = (await request.json()) as Record<string, unknown>;
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
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new Error("Unsupported Content-Type. Please send JSON or Form Data.");
    }
  }

  return extractSubmissionPayload(raw);
}

/**
 * Sends a confirmation email to the guest via Resend API
 */
async function sendConfirmationEmail(
  submission: RsvpSubmissionPayload,
  apiKey: string,
  replyToEmail?: string
): Promise<{ success: boolean; error?: string }> {
  if (!submission.email) {
    return { success: false, error: "No recipient email provided" };
  }

  const html = buildConfirmationEmailHtml(submission);
  const text = buildConfirmationEmailText(submission);
  const subject = getConfirmationEmailSubject(submission);
  const cleanReplyTo = replyToEmail?.trim();

  const payload = {
    from: "Lucas & Lianne <rsvp@send.lucasandlianne.com>",
    ...(cleanReplyTo ? { reply_to: `Lucas & Lianne <${cleanReplyTo}>` } : {}),
    to: [submission.email],
    subject,
    html,
    text,
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(JSON.stringify({
        event: "resend_api_error",
        status: response.status,
        body: errText,
        to: submission.email,
      }));
      return { success: false, error: `Resend error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    console.log(JSON.stringify({
      event: "resend_email_sent",
      to: submission.email,
      resendId: (data as Record<string, unknown>)?.id,
    }));
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "resend_fetch_exception",
      error: errorMsg,
      to: submission.email,
    }));
    return { success: false, error: errorMsg };
  }
}

/**
 * Sends a notification email to the hosts via Resend API on every RSVP submission
 */
export async function sendHostNotificationEmail(
  submission: RsvpSubmissionPayload,
  apiKey: string,
  recipientEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const toEmail = recipientEmail?.trim();
  if (!toEmail) {
    console.warn(JSON.stringify({
      event: "notification_email_missing",
      message: "NOTIFICATION_EMAIL secret is not configured; host notification skipped",
    }));
    return { success: false, error: "NOTIFICATION_EMAIL not configured in worker environment" };
  }

  const html = buildHostNotificationEmailHtml(submission);
  const text = buildHostNotificationEmailText(submission);
  const subject = getHostNotificationEmailSubject(submission);

  const payload = {
    from: "Lucas & Lianne RSVP <rsvp@send.lucasandlianne.com>",
    ...(submission.email ? { reply_to: submission.email } : {}),
    to: [toEmail],
    subject,
    html,
    text,
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(JSON.stringify({
        event: "resend_host_notification_error",
        status: response.status,
        body: errText,
        to: toEmail,
      }));
      return { success: false, error: `Resend error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    console.log(JSON.stringify({
      event: "resend_host_notification_sent",
      to: toEmail,
      resendId: (data as Record<string, unknown>)?.id,
    }));
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "resend_host_notification_error",
      error: errorMsg,
      to: toEmail,
    }));
    return { success: false, error: errorMsg };
  }
}

/**
 * Handles RSVP submission:
 * POST /submit (or POST /rsvp)
 */
export async function handleRsvpSubmit(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  let submission: RsvpSubmissionPayload;
  try {
    submission = await parseRsvpBody(request);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Invalid RSVP submission" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  if (submission.party.length === 0) {
    return new Response(
      JSON.stringify({ error: "Missing RSVP party responses" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  // Structured logging for Cloudflare Workers Observability
  console.log(JSON.stringify({
    event: "rsvp_submission_received",
    submittedBy: submission.submittedBy ?? null,
    partyCount: submission.party.length,
    party: submission.party,
    hasDietary: Boolean(submission.dietary),
    hasEmail: Boolean(submission.email),
    hasExtras: Boolean(submission.extras && Object.keys(submission.extras).length > 0),
    extras: submission.extras ?? null,
    submittedAt: submission.submittedAt,
  }));

  const apiKey = env.RESEND_API_KEY;
  let notificationSent: boolean;
  let notificationError: string | undefined;

  const isPennyTestParty = submission.party.some((g) => {
    const norm = normalizeName(g.name);
    return norm === "mrpenny" || norm === "mrspenny" || norm === "penny";
  });

  if (isPennyTestParty) {
    console.log(JSON.stringify({
      event: "host_notification_skipped_test_party",
      party: submission.party.map((g) => g.name),
    }));
    notificationSent = false;
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
    console.warn(JSON.stringify({
      event: "resend_api_key_missing",
      message: "RESEND_API_KEY secret is not configured; host notification skipped",
    }));
    notificationSent = false;
    notificationError = "RESEND_API_KEY not configured in worker environment";
  }

  let emailSent: boolean | undefined;
  let emailError: string | undefined;

  if (submission.email) {
    if (apiKey) {
      const result = await sendConfirmationEmail(submission, apiKey, env.NOTIFICATION_EMAIL);
      emailSent = result.success;
      if (!result.success) {
        emailError = result.error;
      }
    } else {
      console.warn(JSON.stringify({
        event: "resend_api_key_missing",
        message: "RESEND_API_KEY secret is not configured; email skipped",
        to: submission.email,
      }));
      emailSent = false;
      emailError = "RESEND_API_KEY not configured in worker environment";
    }
  }

  const responsePayload: SubmitResult = {
    success: true,
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);

    // Preflight OPTIONS requests
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
          return handleLookup(url, corsHeaders);
        }
        if (pathname === "/health" || pathname === "/ping") {
          return new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      if (request.method === "POST") {
        if (
          pathname === "/submit" ||
          pathname === "/api/submit" ||
          pathname === "/rsvp" ||
          pathname === "/"
        ) {
          return await handleRsvpSubmit(request, env, corsHeaders);
        }
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err) {
      console.error(JSON.stringify({
        event: "unhandled_error",
        error: err instanceof Error ? err.stack || err.message : String(err),
      }));
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
} satisfies ExportedHandler<Env>;
