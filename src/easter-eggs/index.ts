import { getCurrentLocale, type Locale } from "../i18n";
import { EASTER_EGG_REGISTRY } from "./registry";
import type {
  DelightPayload,
  EasterEggContext,
  EasterEggModule,
  LocalizedNote,
  StoredThanksDelight,
} from "./types";

const THANKS_STORAGE_KEY = "rsvp_thanks_delight";

let activeCleanups: Array<() => void> = [];
let activeDelightPayload: DelightPayload | null = null;
let activeSubmittedBy = "";
let activeParty: string[] = [];

function normalizeIdentifier(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeLocalizedNote(
  note: LocalizedNote | undefined
): { en?: string; es?: string } | undefined {
  if (!note) return undefined;
  if (typeof note === "string") {
    const trimmed = note.trim();
    return trimmed ? { en: trimmed, es: trimmed } : undefined;
  }
  const en = typeof note.en === "string" && note.en.trim() ? note.en.trim() : undefined;
  const es = typeof note.es === "string" && note.es.trim() ? note.es.trim() : undefined;
  if (!en && !es) return undefined;
  return { en: en ?? es, es: es ?? en };
}

export function resolveNoteText(
  note: LocalizedNote | undefined,
  locale: Locale
): string | undefined {
  const normalized = normalizeLocalizedNote(note);
  if (!normalized) return undefined;
  return normalized[locale] ?? normalized.en ?? normalized.es;
}

function extractEffectsList(payload?: DelightPayload | null): string[] {
  if (!payload) return [];
  const list: string[] = [];
  if (typeof payload.effect === "string" && payload.effect.trim()) {
    list.push(payload.effect.trim());
  } else if (Array.isArray(payload.effect)) {
    for (const item of payload.effect) {
      if (typeof item === "string" && item.trim()) list.push(item.trim());
    }
  }
  if (Array.isArray(payload.effects)) {
    for (const item of payload.effects) {
      if (typeof item === "string" && item.trim()) list.push(item.trim());
    }
  }
  return Array.from(new Set(list));
}

/**
 * Decodes the `X-Rsvp-Delight` header sent by the Cloudflare Worker.
 */
export function parseDelightHeader(response?: Response | null): DelightPayload | null {
  if (!response) return null;
  const rawHeader = response.headers.get("X-Rsvp-Delight")?.trim();
  if (!rawHeader) return null;

  try {
    const jsonStr = decodeURIComponent(rawHeader);
    const parsed = JSON.parse(jsonStr) as DelightPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    try {
      const parsed = JSON.parse(atob(rawHeader)) as DelightPayload;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
}

/**
 * Reads optional `?preview_effect=...` / `?delight_preview=...` and `?preview_note=...`
 * query parameters from the current URL for easy one-click browser testing.
 */
export function getPreviewDelightFromUrl(): DelightPayload | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const rawEffect =
    params.get("preview_effect") ||
    params.get("delight_preview") ||
    params.get("effect") ||
    "";
  const rawNote = params.get("preview_note") || params.get("note") || "";

  const effects = rawEffect
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (effects.length === 0 && !rawNote.trim()) {
    return null;
  }

  return {
    ...(rawNote.trim()
      ? {
          rsvpNote: rawNote.trim(),
          thanksNote: rawNote.trim(),
        }
      : {}),
    ...(effects.length > 0 ? { effects } : {}),
    onlyWhenAttending: false,
  };
}

function mergeDelightPayloads(
  base: DelightPayload | null,
  override: DelightPayload | null
): DelightPayload | null {
  if (!base && !override) return null;
  const effects = Array.from(
    new Set([...extractEffectsList(base), ...extractEffectsList(override)])
  );
  return {
    rsvpNote: override?.rsvpNote ?? base?.rsvpNote,
    thanksNote: override?.thanksNote ?? base?.thanksNote,
    emailNote: override?.emailNote ?? base?.emailNote,
    ...(effects.length > 0 ? { effects } : {}),
    onlyWhenAttending: override?.onlyWhenAttending ?? base?.onlyWhenAttending ?? true,
  };
}

function shouldRunModule(mod: EasterEggModule, ctx: EasterEggContext): boolean {
  const { trigger } = mod;
  const allowedPages = trigger.pages ?? ["rsvp"];
  if (!allowedPages.includes(ctx.page)) {
    return false;
  }

  if (trigger.effectIds && trigger.effectIds.length > 0) {
    const activeIds = new Set(ctx.effects.map((id) => normalizeIdentifier(id)));
    if (trigger.effectIds.some((id) => activeIds.has(normalizeIdentifier(id)))) {
      return true;
    }
  }

  if (typeof trigger.matches === "function" && trigger.matches(ctx)) {
    return true;
  }

  return false;
}

function renderCalloutNote(
  containerId: string,
  textId: string,
  noteText: string | undefined
): void {
  const container = document.getElementById(containerId);
  const textEl = document.getElementById(textId);
  if (!container || !textEl) return;

  if (noteText && noteText.trim()) {
    textEl.textContent = noteText.trim();
    container.style.display = "block";
  } else {
    textEl.textContent = "";
    container.style.display = "none";
  }
}

/**
 * Unmounts any active easter egg effects and hides the RSVP note callout.
 */
export function resetRsvpDelights(): void {
  for (const cleanup of activeCleanups) {
    try {
      cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }
  activeCleanups = [];
  activeDelightPayload = null;
  renderCalloutNote("rsvp-delight-note", "rsvp-delight-note-text", undefined);
}

/**
 * Single hook called by `src/rsvp.ts` when Step 2 (the RSVP form) opens for a party.
 * Renders any personal `rsvpNote` and mounts any matching interactive easter egg modules.
 */
export function applyRsvpDelights(options: {
  response?: Response | null;
  party: string[];
  submittedBy: string;
  locale: Locale;
  formElement?: HTMLFormElement | null;
}): void {
  resetRsvpDelights();

  const headerDelight = parseDelightHeader(options.response);
  const previewDelight = getPreviewDelightFromUrl();
  const merged = mergeDelightPayloads(headerDelight, previewDelight);

  activeDelightPayload = merged;
  activeSubmittedBy = options.submittedBy;
  activeParty = options.party;

  // 1. Render custom stationery note if present
  const rsvpNoteText = resolveNoteText(merged?.rsvpNote, options.locale);
  renderCalloutNote("rsvp-delight-note", "rsvp-delight-note-text", rsvpNoteText);

  // 2. Evaluate and mount matching interactive easter eggs
  const ctx: EasterEggContext = {
    page: "rsvp",
    locale: options.locale,
    matchedGuest: options.submittedBy,
    normalizedGuest: normalizeIdentifier(options.submittedBy),
    party: options.party,
    normalizedParty: options.party.map((p) => normalizeIdentifier(p)).filter(Boolean),
    effects: extractEffectsList(merged),
    delight: merged,
    formElement: options.formElement ?? (document.getElementById("rsvp-form") as HTMLFormElement | null),
    cardElement: document.querySelector(".stationery-card") as HTMLElement | null,
  };

  for (const mod of EASTER_EGG_REGISTRY) {
    if (shouldRunModule(mod, ctx)) {
      const cleanup = mod.mount(ctx);
      if (typeof cleanup === "function") {
        activeCleanups.push(cleanup);
      }
    }
  }
}

/**
 * Single hook called by `src/rsvp.ts` right before redirecting to `thanks.html`.
 * Saves `thanksNote` and party attendance state to `sessionStorage`.
 */
export function persistThanksDelightOnSubmit(formElement: HTMLFormElement): void {
  try {
    const formData = new FormData(formElement);
    let anyAttending = false;
    for (const [key, val] of formData.entries()) {
      if (key.startsWith("attending_") && typeof val === "string") {
        const lower = val.toLowerCase();
        if (!lower.includes("decline") && !lower.includes("regret")) {
          anyAttending = true;
        }
      }
    }

    const thanksNote = normalizeLocalizedNote(activeDelightPayload?.thanksNote);
    const effects = extractEffectsList(activeDelightPayload);

    if (!thanksNote && effects.length === 0) {
      sessionStorage.removeItem(THANKS_STORAGE_KEY);
      return;
    }

    const stored: StoredThanksDelight = {
      ...(thanksNote ? { thanksNote } : {}),
      ...(effects.length > 0 ? { effects } : {}),
      onlyWhenAttending: activeDelightPayload?.onlyWhenAttending ?? true,
      anyAttending,
      submittedBy: activeSubmittedBy,
      party: activeParty,
    };
    sessionStorage.setItem(THANKS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage errors in private browsing
  }
}

const DEFAULT_WORKER_URL =
  import.meta.env.VITE_RSVP_WORKER_URL || "https://wedding-rsvp-worker.lucasaffalter.workers.dev/";

/**
 * Extracts optional `?first=...&last=...` or `?name=First+Last` / `?guest=First+Last`
 * query parameters from the URL for direct testing/linking.
 */
export function getGuestQueryFromUrl(): { first: string; last: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const firstParam = params.get("first")?.trim() || "";
  const lastParam = params.get("last")?.trim() || "";
  if (firstParam && lastParam) {
    return { first: firstParam, last: lastParam };
  }

  const fullParam = (params.get("name") || params.get("guest") || "").trim();
  if (fullParam) {
    const parts = fullParam.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        first: parts[0],
        last: parts.slice(1).join(" "),
      };
    }
  }
  return null;
}

/**
 * Optional helper for `rsvp.html`: if the user opens `/rsvp.html?preview_effect=...`
 * or `/rsvp.html?preview_note=...` (without `?first=&last=`), automatically opens
 * Step 2 with a demo guest so they can test effects and notes with one click.
 */
export function initRsvpPreviewIfRequested(options: {
  locale: Locale;
  onPreviewParty: (party: string[], submittedBy: string) => void;
}): void {
  if (getGuestQueryFromUrl()) return;
  const preview = getPreviewDelightFromUrl();
  if (!preview) return;

  const demoParty = ["Mr. Penny", "Mrs. Penny"];
  options.onPreviewParty(demoParty, "Mr. Penny");
}

function mountThanksDelights(options: {
  locale: Locale;
  noteSource: LocalizedNote | undefined;
  effects: string[];
  matchedGuest: string;
  party: string[];
  delight: DelightPayload | null;
}): void {
  const thanksNoteText = resolveNoteText(options.noteSource, options.locale);
  renderCalloutNote("thanks-delight-note", "thanks-delight-note-text", thanksNoteText);

  const ctx: EasterEggContext = {
    page: "thanks",
    locale: options.locale,
    matchedGuest: options.matchedGuest,
    normalizedGuest: normalizeIdentifier(options.matchedGuest),
    party: options.party,
    normalizedParty: options.party.map((p) => normalizeIdentifier(p)).filter(Boolean),
    effects: options.effects,
    delight: options.delight,
  };

  for (const mod of EASTER_EGG_REGISTRY) {
    if (shouldRunModule(mod, ctx)) {
      mod.mount(ctx);
    }
  }
}

/**
 * Initializes custom notes and any `thanks`-page easter eggs on `thanks.html`.
 * Supports both the normal post-submit `sessionStorage` flow and direct URL testing
 * via `?first=...&last=...` (or `?name=First+Last`), which queries the Cloudflare Worker.
 */
export function initThanksDelights(workerUrl: string = DEFAULT_WORKER_URL): void {
  const locale = getCurrentLocale();
  const preview = getPreviewDelightFromUrl();
  const guestQuery = getGuestQueryFromUrl();

  if (guestQuery) {
    void (async () => {
      try {
        const response = await fetch(
          `${workerUrl}?first=${encodeURIComponent(guestQuery.first)}&last=${encodeURIComponent(guestQuery.last)}`
        );
        if (response.ok) {
          const party = (await response.json()) as string[];
          const matchedGuest =
            response.headers.get("X-Matched-Guest")?.trim() ||
            `${guestQuery.first} ${guestQuery.last}`;
          const headerDelight = parseDelightHeader(response);
          const merged = mergeDelightPayloads(headerDelight, preview);

          mountThanksDelights({
            locale,
            noteSource: merged?.thanksNote,
            effects: extractEffectsList(merged),
            matchedGuest,
            party: Array.isArray(party) ? party : [],
            delight: merged,
          });
          return;
        }
      } catch {
        // Fall through to stored/preview fallback on network error
      }

      mountThanksDelights({
        locale,
        noteSource: preview?.thanksNote,
        effects: extractEffectsList(preview),
        matchedGuest: `${guestQuery.first} ${guestQuery.last}`,
        party: [],
        delight: preview,
      });
    })();
    return;
  }

  let stored: StoredThanksDelight | null = null;
  try {
    const raw = sessionStorage.getItem(THANKS_STORAGE_KEY);
    if (raw) {
      stored = JSON.parse(raw) as StoredThanksDelight;
    }
  } catch {
    stored = null;
  }

  const shouldShowStoredNote =
    stored &&
    stored.thanksNote &&
    (stored.onlyWhenAttending === false || stored.anyAttending);

  const noteSource = preview?.thanksNote ?? (shouldShowStoredNote ? stored?.thanksNote : undefined);
  const effects = Array.from(
    new Set([...(stored?.effects ?? []), ...extractEffectsList(preview)])
  );
  const matchedGuest = stored?.submittedBy ?? "";
  const party = stored?.party ?? [];

  mountThanksDelights({
    locale,
    noteSource,
    effects,
    matchedGuest,
    party,
    delight: preview ?? (stored ? { thanksNote: stored.thanksNote, effects: stored.effects } : null),
  });
}
