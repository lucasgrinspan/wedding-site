import "./style.css";
import { initCountdown } from "./countdown";

// console greeting
console.log(
  "%chey what are you doing here",
  "font-size: 18px; font-weight: bold;",
);

// Initialize countdown
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCountdown);
} else {
  initCountdown();
}
