import './style.css'
import { dynamicCopy, getCurrentLocale } from './i18n'

// Dynamic wedding countdown logic
const weddingDate = new Date('2027-02-20T00:00:00');

function updateCountdown() {
  const countdownElement = document.getElementById('countdown');
  if (!countdownElement) return;

  const locale = getCurrentLocale();
  const copy = dynamicCopy[locale].countdown;

  const now = new Date();
  
  // Set both dates to midnight local time for a pure day-based difference
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(weddingDate.getFullYear(), weddingDate.getMonth(), weddingDate.getDate());
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    countdownElement.textContent = copy.daysToGo(diffDays);
  } else if (diffDays === 0) {
    countdownElement.textContent = copy.today;
  } else {
    countdownElement.textContent = copy.married;
  }
}

// Initialize countdown
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateCountdown);
} else {
  updateCountdown();
}
