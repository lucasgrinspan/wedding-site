import type { EasterEggModule } from "../types";

const MAX_DODGES = 4;

const OFFSETS: Array<{ x: number; y: number; rot: number }> = [
  { x: 95, y: -38, rot: 5 },
  { x: -105, y: -28, rot: -6 },
  { x: 80, y: 34, rot: 4 },
  { x: -85, y: -42, rot: -4 },
];

/**
 * Reference Easter Egg implementation: "runaway_button"
 *
 * Playfully dodges the cursor/tap on the Submit button a few times
 * before settling back into place so the guest can submit normally.
 */
export const runawayButtonEffect: EasterEggModule = {
  id: "runaway_button",
  description:
    "Prank mode: Submit button playfully escapes the cursor 3-4 times before settling back into place.",
  trigger: {
    effectIds: ["runaway_button"],
    pages: ["rsvp"],
  },
  mount(ctx) {
    const form = ctx.formElement ?? (document.getElementById("rsvp-form") as HTMLFormElement | null);
    const submitBtn = document.getElementById("btn-submit-rsvp") as HTMLButtonElement | null;
    if (!form || !submitBtn) return;

    let dodgeCount = 0;
    let settled = false;

    const prevTransition = submitBtn.style.transition;
    const prevPosition = submitBtn.style.position;
    const prevZIndex = submitBtn.style.zIndex;

    submitBtn.style.transition = "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)";
    submitBtn.style.position = "relative";
    submitBtn.style.zIndex = "20";

    const triggerDodge = (event?: Event) => {
      if (settled) return;

      if (dodgeCount < MAX_DODGES - 1) {
        if (event && event.cancelable) {
          event.preventDefault();
        }
        const offset = OFFSETS[dodgeCount % OFFSETS.length];
        // Constrain horizontal offset on narrow mobile screens so button stays visible
        const maxHorizontal = Math.max(45, Math.min(110, (window.innerWidth - submitBtn.offsetWidth) / 2 - 20));
        const clampedX = Math.max(-maxHorizontal, Math.min(maxHorizontal, offset.x));

        submitBtn.style.transform = `translate(${clampedX}px, ${offset.y}px) rotate(${offset.rot}deg)`;
        dodgeCount += 1;
      } else {
        // Final hover/tap: return smoothly to origin and let them click!
        settled = true;
        submitBtn.style.transform = "translate(0px, 0px) rotate(0deg)";
      }
    };

    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !e.pointerType) {
        triggerDodge(e);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!settled) {
        triggerDodge(e);
      }
    };

    submitBtn.addEventListener("pointerenter", onPointerEnter);
    submitBtn.addEventListener("touchstart", onTouchStart, { passive: false });

    return () => {
      submitBtn.removeEventListener("pointerenter", onPointerEnter);
      submitBtn.removeEventListener("touchstart", onTouchStart);
      submitBtn.style.transform = "";
      submitBtn.style.transition = prevTransition;
      submitBtn.style.position = prevPosition;
      submitBtn.style.zIndex = prevZIndex;
    };
  },
};
