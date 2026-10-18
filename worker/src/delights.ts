import rsvpDelightsData from "../data/rsvp_delights.json";
import rsvpLookupData from "../data/rsvp_lookup.json";
import {
  DelightConfigEntry,
  GuestDelightPayload,
  LocalizedNote,
  RsvpSubmissionPayload,
} from "./types";

const lookupRecord = rsvpLookupData as Record<string, unknown>;

interface RawDelightsFile {
  guests?: Record<string, DelightConfigEntry>;
  parties?: Record<string, DelightConfigEntry>;
}

const rawDelights = rsvpDelightsData as unknown as RawDelightsFile;

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeNote(
  note: LocalizedNote | undefined
): { en?: string; es?: string } | undefined {
  if (!note) return undefined;
  if (typeof note === "string") {
    const trimmed = note.trim();
    if (!trimmed) return undefined;
    return { en: trimmed, es: trimmed };
  }
  const en = typeof note.en === "string" && note.en.trim() ? note.en.trim() : undefined;
  const es = typeof note.es === "string" && note.es.trim() ? note.es.trim() : undefined;
  if (!en && !es) return undefined;
  return {
    en: en ?? es,
    es: es ?? en,
  };
}

function normalizeEffects(entry?: DelightConfigEntry): string[] {
  if (!entry) return [];
  const rawList: string[] = [];
  if (typeof entry.effect === "string" && entry.effect.trim()) {
    rawList.push(entry.effect.trim());
  } else if (Array.isArray(entry.effect)) {
    for (const item of entry.effect) {
      if (typeof item === "string" && item.trim()) {
        rawList.push(item.trim());
      }
    }
  }
  if (Array.isArray(entry.effects)) {
    for (const item of entry.effects) {
      if (typeof item === "string" && item.trim()) {
        rawList.push(item.trim());
      }
    }
  }
  return Array.from(new Set(rawList));
}

const DEFAULT_PARTIES_DELIGHTS: Record<string, DelightConfigEntry> = {
  mrpenny: {
    rsvpNote: "Here is where the RSVP note goes",
    thanksNote: "Here is where the thanks note goes",
    emailNote: "Here is where the confirmation email note goes",
  },
};

// Build normalized lookup maps for parties and guests
const normalizedPartiesMap = new Map<string, DelightConfigEntry>();
for (const [k, v] of Object.entries(DEFAULT_PARTIES_DELIGHTS)) {
  normalizedPartiesMap.set(normalizeKey(k), v);
}
if (rawDelights.parties && typeof rawDelights.parties === "object") {
  for (const [k, v] of Object.entries(rawDelights.parties)) {
    const nk = normalizeKey(k);
    if (nk && v && typeof v === "object") {
      normalizedPartiesMap.set(nk, v);
    }
  }
}

const normalizedGuestsMap = new Map<string, DelightConfigEntry>();
if (rawDelights.guests && typeof rawDelights.guests === "object") {
  for (const [k, v] of Object.entries(rawDelights.guests)) {
    const nk = normalizeKey(k);
    if (nk && v && typeof v === "object") {
      normalizedGuestsMap.set(nk, v);
    }
  }
}

// Precompute map from party signature -> all lookup keys that point to that party
const partyLookupKeysMap = new Map<string, string[]>();
for (const [lookupKey, partyMembers] of Object.entries(lookupRecord)) {
  if (lookupKey.startsWith("_") || !Array.isArray(partyMembers)) continue;
  const sig = partyMembers.map((m) => normalizeKey(String(m))).sort().join("|");
  const existing = partyLookupKeysMap.get(sig) ?? [];
  existing.push(normalizeKey(lookupKey));
  partyLookupKeysMap.set(sig, existing);
}

/**
 * Resolves the merged delight configuration (party-level + guest-level) for a party and matched guest.
 */
export function resolveGuestDelight(options: {
  party: string[];
  matchedGuest?: string | null;
  first?: string;
  last?: string;
}): GuestDelightPayload | null {
  const { party, matchedGuest, first, last } = options;
  if (!Array.isArray(party) || party.length === 0) return null;

  // 1. Find matching party entry (by any party member's normalized name or any lookup key for this party)
  let partyEntry: DelightConfigEntry | undefined;
  const partyMemberNorms = party.map((m) => normalizeKey(m)).filter(Boolean);
  for (const normMember of partyMemberNorms) {
    const found = normalizedPartiesMap.get(normMember);
    if (found) {
      partyEntry = found;
      break;
    }
  }

  if (!partyEntry) {
    const sig = [...partyMemberNorms].sort().join("|");
    const relatedKeys = partyLookupKeysMap.get(sig) ?? [];
    for (const rk of relatedKeys) {
      const found = normalizedPartiesMap.get(rk);
      if (found) {
        partyEntry = found;
        break;
      }
    }
  }

  // 2. Find matching individual guest entry
  let guestEntry: DelightConfigEntry | undefined;
  const candidateGuestKeys = new Set<string>();
  if (matchedGuest) {
    const normMatched = normalizeKey(matchedGuest);
    if (normMatched) candidateGuestKeys.add(normMatched);
  }
  if (first && last) {
    const rawLookupKey = normalizeKey(`${first}${last}`);
    if (rawLookupKey) candidateGuestKeys.add(rawLookupKey);
  }
  // If single-person party, any lookup key for that party unambiguously identifies this guest
  if (party.length === 1) {
    const sig = partyMemberNorms.join("|");
    for (const rk of partyLookupKeysMap.get(sig) ?? []) {
      candidateGuestKeys.add(rk);
    }
  }

  for (const key of candidateGuestKeys) {
    const found = normalizedGuestsMap.get(key);
    if (found) {
      guestEntry = found;
      break;
    }
  }

  if (!partyEntry && !guestEntry) {
    return null;
  }

  const rsvpNote = normalizeNote(guestEntry?.rsvpNote ?? partyEntry?.rsvpNote);
  const thanksNote = normalizeNote(guestEntry?.thanksNote ?? partyEntry?.thanksNote);
  const emailNote = normalizeNote(guestEntry?.emailNote ?? partyEntry?.emailNote);
  const effects = Array.from(
    new Set([...normalizeEffects(partyEntry), ...normalizeEffects(guestEntry)])
  );
  const onlyWhenAttending =
    guestEntry?.onlyWhenAttending ?? partyEntry?.onlyWhenAttending ?? true;

  if (!rsvpNote && !thanksNote && !emailNote && effects.length === 0) {
    return null;
  }

  return {
    ...(rsvpNote ? { rsvpNote } : {}),
    ...(thanksNote ? { thanksNote } : {}),
    ...(emailNote ? { emailNote } : {}),
    ...(effects.length > 0 ? { effects } : {}),
    onlyWhenAttending,
  };
}

/**
 * Encodes the delight payload safely as URI-encoded UTF-8 JSON for the X-Rsvp-Delight HTTP header.
 */
export function encodeDelightHeader(delight: GuestDelightPayload): string {
  const clientPayload: GuestDelightPayload = {
    ...(delight.rsvpNote ? { rsvpNote: delight.rsvpNote } : {}),
    ...(delight.thanksNote ? { thanksNote: delight.thanksNote } : {}),
    ...(delight.effects && delight.effects.length > 0 ? { effects: delight.effects } : {}),
    ...(delight.onlyWhenAttending !== undefined
      ? { onlyWhenAttending: delight.onlyWhenAttending }
      : {}),
  };
  return encodeURIComponent(JSON.stringify(clientPayload));
}

/**
 * Resolves the localized confirmation email note for an RSVP submission,
 * respecting `onlyWhenAttending` (defaults to true so all-declining parties don't receive celebratory notes).
 */
export function resolveEmailNoteForSubmission(
  submission: Pick<RsvpSubmissionPayload, "party" | "submittedBy" | "lang" | "personalNote">
): string | undefined {
  if (typeof submission.personalNote === "string" && submission.personalNote.trim()) {
    return submission.personalNote.trim();
  }

  const partyNames = submission.party.map((p) => p.name);
  const delight = resolveGuestDelight({
    party: partyNames,
    matchedGuest: submission.submittedBy ?? (partyNames.length === 1 ? partyNames[0] : null),
  });

  if (!delight || !delight.emailNote) {
    return undefined;
  }

  const anyAttending = submission.party.some((g) => g.attending);
  if (delight.onlyWhenAttending !== false && !anyAttending) {
    return undefined;
  }

  const locale = submission.lang === "es" ? "es" : "en";
  return delight.emailNote[locale] ?? delight.emailNote.en ?? delight.emailNote.es;
}
