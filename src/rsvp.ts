import {
  applyRsvpDelights,
  initRsvpPreviewIfRequested,
  persistThanksDelightOnSubmit,
  resetRsvpDelights,
} from "./easter-eggs";
import { dynamicCopy, getCurrentLocale } from "./i18n";

// Configurable variables loaded from Vite environment variables (with fallbacks)
const WORKER_URL = import.meta.env.VITE_RSVP_WORKER_URL || "https://wedding-rsvp-worker.lucasaffalter.workers.dev/";

document.addEventListener("DOMContentLoaded", () => {
  const locale = getCurrentLocale();
  const copy = dynamicCopy[locale].rsvp;

  const searchStep = document.getElementById("rsvp-search-step");
  const rsvpForm = document.getElementById("rsvp-form") as HTMLFormElement | null;
  const firstNameInput = document.getElementById("first-name") as HTMLInputElement | null;
  const lastNameInput = document.getElementById("last-name") as HTMLInputElement | null;
  const btnFindInvitation = document.getElementById("btn-find-invitation") as HTMLButtonElement | null;
  const btnBackSearch = document.getElementById("btn-back-search") as HTMLButtonElement | null;
  const btnSubmitRsvp = document.getElementById("btn-submit-rsvp") as HTMLButtonElement | null;
  const searchError = document.getElementById("search-error");
  const submitError = document.getElementById("submit-error");
  const guestRowsContainer = document.getElementById("guest-rows-container");
  const partyListHiddenInput = document.getElementById("rsvp-party-list") as HTMLInputElement | null;
  const submittedByHiddenInput = document.getElementById("rsvp-submitted-by") as HTMLInputElement | null;
  const emailInput = document.getElementById("email") as HTMLInputElement | null;

  function normalizeName(name: string): string {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function resolveSubmittedBy(first: string, last: string, party: string[]): string {
    const cleanFallback = `${first.trim()} ${last.trim()}`.trim();
    if (!Array.isArray(party) || party.length === 0) {
      return cleanFallback;
    }
    if (party.length === 1) {
      return party[0];
    }

    const normFull = normalizeName(`${first}${last}`);
    const normFirst = normalizeName(first.trim().split(/[\s-]+/)[0] || first);

    return (
      party.find((member) => normalizeName(member) === normFull) ||
      party.find((member) => normalizeName(member.split(/[\s-]+/)[0] || "") === normFirst) ||
      cleanFallback
    );
  }

  if (rsvpForm) {
    rsvpForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (emailInput) {
        emailInput.value = emailInput.value.trim();
      }

      const spinner = btnSubmitRsvp?.querySelector(".spinner") as HTMLElement | null;
      if (spinner) spinner.style.display = "inline-block";
      if (btnSubmitRsvp) btnSubmitRsvp.disabled = true;
      if (btnBackSearch) btnBackSearch.disabled = true;
      if (submitError) submitError.style.display = "none";

      try {
        const formData = new FormData(rsvpForm);
        const submitEndpoint = WORKER_URL.endsWith("/") ? `${WORKER_URL}submit` : `${WORKER_URL}/submit`;
        const response = await fetch(submitEndpoint, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          persistThanksDelightOnSubmit(rsvpForm);
          const nextInput = rsvpForm.querySelector('input[name="_next"]') as HTMLInputElement | null;
          const nextUrl = nextInput?.value || (locale === "es" ? "/es/thanks.html" : "/thanks.html");
          window.location.href = nextUrl;
          return;
        } else {
          showSubmitError(copy.serverError);
        }
      } catch (err) {
        showSubmitError(copy.networkError);
      }

      if (spinner) spinner.style.display = "none";
      if (btnSubmitRsvp) btnSubmitRsvp.disabled = false;
      if (btnBackSearch) btnBackSearch.disabled = false;
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
          const headerMatchedGuest = response.headers.get("X-Matched-Guest")?.trim();
          const submittedBy = headerMatchedGuest || resolveSubmittedBy(first, last, party);
          setupRsvpForm(party, submittedBy, response);
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
      if (submitError) submitError.style.display = "none";
      resetRsvpDelights();
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

  function showSubmitError(message: string) {
    if (submitError) {
      submitError.textContent = message;
      submitError.style.display = "block";
    }
  }

  function setupRsvpForm(party: string[], submittedBy: string, response?: Response) {
    if (!guestRowsContainer || !partyListHiddenInput || !searchStep || !rsvpForm) return;

    // Clear old rows
    guestRowsContainer.innerHTML = "";
    
    // Populate hidden list of members and who searched/submitted
    partyListHiddenInput.value = party.join(", ");
    if (submittedByHiddenInput) {
      submittedByHiddenInput.value = submittedBy;
    }

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

    // Apply any guest/party custom note or interactive easter egg
    applyRsvpDelights({
      response,
      party,
      submittedBy,
      locale,
      formElement: rsvpForm,
    });
  }

  initRsvpPreviewIfRequested({
    locale,
    onPreviewParty: (party, submittedBy) => setupRsvpForm(party, submittedBy),
  });
});

