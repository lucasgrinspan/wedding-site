import { dynamicCopy, getCurrentLocale } from "./i18n";

// Configurable variables loaded from Vite environment variables (with fallbacks)
const WORKER_URL = import.meta.env.VITE_RSVP_WORKER_URL || "https://wedding-rsvp-worker.lucasaffalter.workers.dev/";
const FORMSPREE_URL = import.meta.env.VITE_FORMSPREE_URL || "https://formspree.io/f/mojndlqj";

document.addEventListener("DOMContentLoaded", () => {
  const locale = getCurrentLocale();
  const copy = dynamicCopy[locale].rsvp;

  const searchStep = document.getElementById("rsvp-search-step");
  const rsvpForm = document.getElementById("rsvp-form") as HTMLFormElement | null;
  const firstNameInput = document.getElementById("first-name") as HTMLInputElement | null;
  const lastNameInput = document.getElementById("last-name") as HTMLInputElement | null;
  const btnFindInvitation = document.getElementById("btn-find-invitation") as HTMLButtonElement | null;
  const btnBackSearch = document.getElementById("btn-back-search") as HTMLButtonElement | null;
  const searchError = document.getElementById("search-error");
  const guestRowsContainer = document.getElementById("guest-rows-container");
  const partyListHiddenInput = document.getElementById("formspree-party-list") as HTMLInputElement | null;
  const emailInput = document.getElementById("email") as HTMLInputElement | null;

  // Dynamically set the Formspree action endpoint
  if (rsvpForm) {
    rsvpForm.action = FORMSPREE_URL;

    rsvpForm.addEventListener("submit", () => {
      if (emailInput) {
        emailInput.value = emailInput.value.trim();
      }

      // If guest provided an email, dispatch to worker to send confirmation email
      if (emailInput && emailInput.value) {
        try {
          const formData = new FormData(rsvpForm);
          const submitEndpoint = WORKER_URL.endsWith("/") ? `${WORKER_URL}submit` : `${WORKER_URL}/submit`;
          fetch(submitEndpoint, {
            method: "POST",
            body: formData,
            keepalive: true,
          }).catch(err => {
            console.warn("Could not dispatch confirmation email:", err);
          });
        } catch (e) {
          console.warn("Failed to prepare confirmation dispatch:", e);
        }
      }
    });
  }

  if (btnFindInvitation && firstNameInput && lastNameInput) {
    btnFindInvitation.addEventListener("click", async () => {
      const first = firstNameInput.value.trim();
      const last = lastNameInput.value.trim();

      if (!first || !last) {
        showError(copy.missingFields);
        return;
      }

      // Show loading spinner
      const spinner = btnFindInvitation.querySelector(".spinner") as HTMLElement | null;
      if (spinner) spinner.style.display = "inline-block";
      btnFindInvitation.disabled = true;
      if (searchError) searchError.style.display = "none";

      try {
        const response = await fetch(`${WORKER_URL}?first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}`);
        
        if (response.ok) {
          const party = await response.json();
          setupRsvpForm(party);
        } else if (response.status === 404) {
          showError(copy.notFound);
        } else {
          showError(copy.serverError);
        }
      } catch (error) {
        showError(copy.networkError);
      } finally {
        // Hide loading spinner
        if (spinner) spinner.style.display = "none";
        btnFindInvitation.disabled = false;
      }
    });
  }

  if (btnBackSearch && rsvpForm && searchStep) {
    btnBackSearch.addEventListener("click", () => {
      rsvpForm.style.display = "none";
      searchStep.style.display = "block";
    });
  }

  function showError(message: string) {
    if (searchError) {
      searchError.textContent = message;
      searchError.style.display = "block";
    }
  }

  function setupRsvpForm(party: string[]) {
    if (!guestRowsContainer || !partyListHiddenInput || !searchStep || !rsvpForm) return;

    // Clear old rows
    guestRowsContainer.innerHTML = "";
    
    // Populate hidden list of members
    partyListHiddenInput.value = party.join(", ");

    // Inject row for each party member
    party.forEach(guest => {
      const sanitizedGuestName = guest.replace(/[^a-zA-Z0-9]/g, "_");
      const rowHtml = `
        <div class="guest-rsvp-row">
          <span class="guest-name-label">${guest}</span>
          <div class="guest-options-group">
            <label class="radio-option">
              <input type="radio" name="attending_${sanitizedGuestName}" value="Joyfully Accept" required checked>
              <span>${copy.acceptLabel}</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="attending_${sanitizedGuestName}" value="Regretfully Decline">
              <span>${copy.declineLabel}</span>
            </label>
          </div>
        </div>
      `;
      guestRowsContainer.insertAdjacentHTML("beforeend", rowHtml);
    });

    // Switch views
    searchStep.style.display = "none";
    rsvpForm.style.display = "block";
  }
});
