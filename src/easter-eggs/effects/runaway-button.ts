import type { EasterEggModule } from "../types";

const MAX_DODGES = 4;

const COPY = {
  en: {
    taunts: [
      "Nice try! 😉",
      "Too slow! 🏃‍♂️💨",
      "Almost had it! 😂",
      "Okay, okay, you win! 🥭",
    ],
    declineTaunt: "Wait, declining?! Not allowed! 😉",
  },
  es: {
    taunts: [
      "¡Buen intento! 😉",
      "¡Muy lento! 🏃‍♂️💨",
      "¡Casi lo tenés! 😂",
      "¡Bueno, está bien, ganaste! 🥭",
    ],
    declineTaunt: "¡¿Cómo que no venís?! ¡No permitido! 😉",
  },
} as const;

const OFFSETS: Array<{ x: number; y: number; rot: number }> = [
  { x: 95, y: -38, rot: 5 },
  { x: -105, y: -28, rot: -6 },
  { x: 80, y: 34, rot: 4 },
  { x: -85, y: -42, rot: -4 },
];

/**
 * Reference Easter Egg implementation: "runaway_button"
 *
 * Playfully dodges the cursor/tap on the Submit button a few times with a cheeky
 * floating caption before settling back into place so the guest can submit normally.
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

    const copy = COPY[ctx.locale] ?? COPY.en;
    let dodgeCount = 0;
    let settled = false;
    let settleTimeout: number | undefined;

    // Create a self-contained floating caption badge above the button area
    const badge = document.createElement("div");
    badge.className = "easter-egg-runaway-badge";
    badge.setAttribute("aria-live", "polite");
    badge.style.display = "none";

    const actionRow = submitBtn.parentElement;
    if (actionRow) {
      actionRow.style.position = "relative";
      actionRow.appendChild(badge);
    }

    const prevTransition = submitBtn.style.transition;
    const prevPosition = submitBtn.style.position;
    const prevZIndex = submitBtn.style.zIndex;

    submitBtn.style.transition = "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)";
    submitBtn.style.position = "relative";
    submitBtn.style.zIndex = "20";

    const showBadgeMessage = (msg: string, autoHideMs?: number) => {
      badge.textContent = msg;
      badge.style.display = "inline-block";
      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
      }
      if (autoHideMs) {
        settleTimeout = window.setTimeout(() => {
          badge.style.display = "none";
        }, autoHideMs);
      }
    };

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
        showBadgeMessage(copy.taunts[dodgeCount] ?? copy.taunts[0]);
        dodgeCount += 1;
      } else {
        // Final hover/tap: return smoothly to origin and let them click!
        settled = true;
        submitBtn.style.transform = "translate(0px, 0px) rotate(0deg)";
        showBadgeMessage(copy.taunts[copy.taunts.length - 1], 3200);
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

    // Also show a cheeky message if they try to select "Regretfully Decline"
    const declineInputs = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[type="radio"][value="Regretfully Decline"]')
    );
    const onDeclineChange = () => {
      showBadgeMessage(copy.declineTaunt, 3000);
    };

    submitBtn.addEventListener("pointerenter", onPointerEnter);
    submitBtn.addEventListener("touchstart", onTouchStart, { passive: false });
    declineInputs.forEach((input) => input.addEventListener("change", onDeclineChange));

    return () => {
      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
      }
      submitBtn.removeEventListener("pointerenter", onPointerEnter);
      submitBtn.removeEventListener("touchstart", onTouchStart);
      declineInputs.forEach((input) => input.removeEventListener("change", onDeclineChange));
      submitBtn.style.transform = "";
      submitBtn.style.transition = prevTransition;
      submitBtn.style.position = prevPosition;
      submitBtn.style.zIndex = prevZIndex;
      badge.remove();
    };
  },
};
