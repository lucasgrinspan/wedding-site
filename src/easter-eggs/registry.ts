import { runawayButtonEffect } from "./effects/runaway-button";
import type { EasterEggModule } from "./types";

/**
 * Central registry of interactive RSVP / Thank-You Easter Eggs.
 *
 * How to add a new Easter Egg:
 * 1. Create a self-contained module under `src/easter-eggs/effects/<name>.ts`
 *    implementing `EasterEggModule`.
 * 2. Register it in `EASTER_EGG_REGISTRY` below.
 * 3. Trigger it either by:
 *    - Adding `"effect": "<id>"` to a guest or party in `worker/data/rsvp_delights.json`, OR
 *    - Specifying `guests` / `parties` / `matches` directly on the module's `trigger` object, OR
 *    - Appending `?preview_effect=<id>` to `/rsvp.html` or `/thanks.html`.
 */
export const EASTER_EGG_REGISTRY: EasterEggModule[] = [
  runawayButtonEffect,
];
