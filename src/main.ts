import "./style.css";
import { initCountdown } from "./countdown";

// console greeting
console.log(
  "%chey what are you doing here",
  "font-size: 18px; font-weight: bold;",
);

// Synchronize Good-to-Know <details> open state with desktop viewport (>= 768px)
function initGoodToKnowDetails(): void {
  const items = document.querySelectorAll<HTMLDetailsElement>("details.gtk-item");
  if (!items.length || typeof window === "undefined" || !window.matchMedia) return;

  const desktopQuery = window.matchMedia("(min-width: 768px)");
  if (desktopQuery.matches) {
    for (const item of items) {
      item.open = true;
    }
  }

  desktopQuery.addEventListener("change", (event) => {
    for (const item of items) {
      item.open = event.matches;
    }
  });
}

function initPage(): void {
  initCountdown();
  initGoodToKnowDetails();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
