import type { EasterEggModule } from "../types";

const MAX_DODGES = 3;

const OFFSETS: Array<{ x: number; y: number; rot: number }> = [
  { x: 90, y: -36, rot: 5 },
  { x: -95, y: -28, rot: -6 },
  { x: 75, y: 30, rot: 4 },
];

/**
 * Reference Easter Egg implementation: "runaway_button"
 *
 * Playfully dodges the cursor/tap on the Submit button 3 times
 * before settling back into place so the guest can submit normally.
 */
export const runawayButtonEffect: EasterEggModule = {
  id: "runaway_button",
  description:
    "Prank mode: Submit button playfully escapes the cursor 3 times before settling back into place.",
  trigger: {
    effectIds: ["runaway_button"],
    pages: ["rsvp"],
  },
  mount(ctx) {
    const form =
      ctx.formElement ?? (document.getElementById("rsvp-form") as HTMLFormElement | null);
    const submitBtn = document.getElementById("btn-submit-rsvp") as HTMLButtonElement | null;
    if (!form || !submitBtn) return;

    let dodgeCount = 0;
    let settled = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const prevTransition = submitBtn.style.transition;
    const prevPosition = submitBtn.style.position;
    const prevZIndex = submitBtn.style.zIndex;

    submitBtn.style.transition = "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)";
    submitBtn.style.position = "relative";
    submitBtn.style.zIndex = "20";

    const triggerDodge = (event?: Event) => {
      if (settled) return;

      if (dodgeCount < MAX_DODGES) {
        if (event && event.cancelable) {
          event.preventDefault();
        }
        const offset = OFFSETS[dodgeCount % OFFSETS.length];

        // Temporarily compute natural origin bounds so button never clips off-screen
        const prevTransform = submitBtn.style.transform;
        submitBtn.style.transform = "none";
        const rect = submitBtn.getBoundingClientRect();
        submitBtn.style.transform = prevTransform;

        const minX = -(rect.left - 12);
        const maxX = window.innerWidth - rect.right - 12;
        const clampedX = Math.max(minX, Math.min(maxX, offset.x));

        submitBtn.style.transform = `translate(${clampedX}px, ${offset.y}px) rotate(${offset.rot}deg)`;
        dodgeCount += 1;

        if (dodgeCount >= MAX_DODGES) {
          // Smoothly return to natural position right after the final dodge so the next tap/click lands cleanly
          resetTimer = setTimeout(() => {
            settled = true;
            submitBtn.style.transform = "translate(0px, 0px) rotate(0deg)";
          }, 420);
        }
      } else {
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
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
      submitBtn.removeEventListener("pointerenter", onPointerEnter);
      submitBtn.removeEventListener("touchstart", onTouchStart);
      submitBtn.style.transform = "";
      submitBtn.style.transition = prevTransition;
      submitBtn.style.position = prevPosition;
      submitBtn.style.zIndex = prevZIndex;
    };
  },
};
