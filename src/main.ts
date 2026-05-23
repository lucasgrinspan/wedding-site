import './style.css'

// Dynamic wedding countdown logic
const weddingDate = new Date('2027-02-20T00:00:00');

function updateCountdown() {
  const countdownElement = document.getElementById('countdown');
  if (!countdownElement) return;

  const now = new Date();
  
  // Set both dates to midnight local time for a pure day-based difference
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(weddingDate.getFullYear(), weddingDate.getMonth(), weddingDate.getDate());
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    countdownElement.textContent = `${diffDays} DAYS TO GO!`;
  } else if (diffDays === 0) {
    countdownElement.textContent = `TODAY IS THE BIG DAY!`;
  } else {
    countdownElement.textContent = `JUST MARRIED!`;
  }
}

// Initialize countdown
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateCountdown);
} else {
  updateCountdown();
}
