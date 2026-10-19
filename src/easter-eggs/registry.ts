import { bocaRiverEffect } from "./effects/boca-river";
import { chickenNuggetsEffect } from "./effects/chicken-nuggets";
import { runawayButtonEffect } from "./effects/runaway-button";
import { threesTourneyEffect } from "./effects/threes-tourney";
import type { EasterEggModule } from "./types";

/**
 * Central registry of interactive RSVP / Thank-You Easter Eggs.
 *
 * How to add a new Easter Egg:
 * 1. Create a self-contained module under `src/easter-eggs/effects/<name>.ts`
 *    implementing `EasterEggModule`.
 * 2. Register it in `EASTER_EGG_REGISTRY` below.
 * 3. Trigger it either by:
 *    - Adding `"effect": "<id>"` to a guest or party in `worker/data/rsvp_delights.json`
 *      (kept server-side so guest names are never exposed in the public repo), OR
 *    - Appending `?preview_effect=<id>` to `/rsvp.html` or `/thanks.html`.
 */
export const EASTER_EGG_REGISTRY: EasterEggModule[] = [
  runawayButtonEffect,
  bocaRiverEffect,
  threesTourneyEffect,
  chickenNuggetsEffect
];
