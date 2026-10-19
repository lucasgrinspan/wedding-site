import { dynamicCopy, getCurrentLocale, type Locale } from "./i18n";

export type CountdownCopy = (typeof dynamicCopy)[Locale]["countdown"];

export type CountdownFunction = (
  copy: CountdownCopy,
  now: Date,
  target: Date,
) => string;

export type CountdownVariant =
  CountdownFunction | { fn: CountdownFunction; intervalPeriod: number };

// Ceremony time: February 20, 2027 at 5:00 PM EST (UTC-5)
export const weddingDate = new Date("2027-02-20T17:00:00-05:00");

let currentCountdownIndex = 0;
let countdownIntervalId: number | undefined = undefined;

export const countdownVariants: CountdownVariant[] = [
  // simple date
  (copy, now, target) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(
      target.getFullYear(),
      target.getMonth(),
      target.getDate(),
    );
    const diffTime = targetDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return copy.daysToGo(diffDays);
    } else if (diffDays === 0) {
      return copy.today;
    } else {
      return copy.married;
    }
  },
  // hours
  (copy, now, target) => {
    const diffTime = target.getTime() - now.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    if (diffHours > 0) {
      return `${diffHours.toLocaleString()} hours to go!`;
    } else if (diffHours > -8) {
      return "YOU SHOULD BE AT THE CEREMONY";
    } else {
      return copy.married;
    }
  },
  // seconds
  {
    intervalPeriod: 1000,
    fn: (copy, now, target) => {
      const diffTime = target.getTime() - now.getTime();
      const diffSeconds = Math.ceil(diffTime / 1000);
      if (diffSeconds > 0) {
        return `${diffSeconds.toLocaleString()} seconds to go!`;
      } else if (diffSeconds > -28800) {
        return "YOU SHOULD BE AT THE CEREMONY";
      } else {
        return copy.married;
      }
    },
  },
  // heartbeats (~75 bpm)
  {
    intervalPeriod: 800,
    fn: (copy, now, target) => {
      const diffTime = target.getTime() - now.getTime();
      const heartbeats = Math.max(0, Math.floor((diffTime / 60000) * 75));
      if (diffTime > 0) {
        const formatted = heartbeats.toLocaleString("en-US");
        return `~${formatted} heartbeats to go 💓`;
      } else if (diffTime > -28800000) {
        return "YOU SHOULD BE AT THE CEREMONY 💓";
      } else {
        return copy.married;
      }
    },
  },
  // coffees
  (copy, now, target) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(
      target.getFullYear(),
      target.getMonth(),
      target.getDate(),
    );
    const diffTime = targetDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return `${diffDays} morning coffees to go ☕`;
    } else if (diffDays === 0) {
      return copy.today;
    } else {
      return copy.married;
    }
  },
];

export function updateCountdown(
  variantIndex: number = currentCountdownIndex,
): void {
  if (countdownIntervalId) clearInterval(countdownIntervalId);

  const countdownElement = document.getElementById("countdown");
  if (!countdownElement) return;

  const locale = getCurrentLocale();
  const copy = dynamicCopy[locale].countdown;

  const now = new Date();
  const target = weddingDate;

  const variant = countdownVariants[variantIndex % countdownVariants.length];
  if ("intervalPeriod" in variant) {
    countdownElement.textContent = variant.fn(copy, now, target);
    countdownIntervalId = window.setInterval(() => {
      countdownElement.textContent = variant.fn(copy, new Date(), target);
    }, variant.intervalPeriod);
  } else {
    countdownElement.textContent = variant(copy, now, target);
  }
}

export function registerCountdownCycle(): void {
  const countdownElement = document.getElementById("countdown");
  if (!countdownElement) return;

  countdownElement.addEventListener("click", () => {
    currentCountdownIndex =
      (currentCountdownIndex + 1) % countdownVariants.length;
    updateCountdown(currentCountdownIndex);
  });
}

export function initCountdown(): void {
  updateCountdown(currentCountdownIndex);
  registerCountdownCycle();
}
