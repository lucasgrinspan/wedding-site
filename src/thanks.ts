import { getStoredThanksState, initThanksDelights } from "./easter-eggs";
import { dynamicCopy, getCurrentLocale } from "./i18n";

document.addEventListener("DOMContentLoaded", () => {
  const locale = getCurrentLocale();
  const stored = getStoredThanksState();
  if (stored && stored.anyAttending === false) {
    const celebrateEl = document.getElementById("thanks-celebrate-msg");
    if (celebrateEl) {
      celebrateEl.textContent = dynamicCopy[locale].thanks.declinedCelebrate;
    }
  }

  initThanksDelights();
});
