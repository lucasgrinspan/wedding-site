import type { Locale } from "../i18n";

export type LocalizedNote = string | { en?: string; es?: string };

export interface DelightPayload {
  rsvpNote?: LocalizedNote;
  thanksNote?: LocalizedNote;
  emailNote?: LocalizedNote;
  effect?: string | string[];
  effects?: string[];
  onlyWhenAttending?: boolean;
}

export interface StoredThanksDelight {
  thanksNote?: { en?: string; es?: string };
  effects?: string[];
  onlyWhenAttending?: boolean;
  anyAttending: boolean;
  submittedBy?: string;
  party?: string[];
}

export interface EasterEggContext {
  page: "rsvp" | "thanks";
  locale: Locale;
  matchedGuest: string;
  normalizedGuest: string;
  party: string[];
  normalizedParty: string[];
  effects: string[];
  delight: DelightPayload | null;
  formElement?: HTMLFormElement | null;
  cardElement?: HTMLElement | null;
}

export interface EasterEggTrigger {
  /**
   * Effect ID(s) that activate this module when returned in `X-Rsvp-Delight`
   * (from `worker/data/rsvp_delights.json`) or via `?preview_effect=<id>`.
   */
  effectIds?: string[];
  /**
   * Which page(s) this module should run on. Defaults to `["rsvp"]`.
   */
  pages?: Array<"rsvp" | "thanks">;
  /**
   * Optional custom predicate for arbitrary trigger rules.
   */
  matches?: (ctx: EasterEggContext) => boolean;
}

export interface EasterEggModule {
  id: string;
  description?: string;
  trigger: EasterEggTrigger;
  /**
   * Executes the effect and optionally returns a cleanup function called when
   * navigating back to the search step or resetting the form.
   */
  mount: (ctx: EasterEggContext) => void | (() => void);
}
