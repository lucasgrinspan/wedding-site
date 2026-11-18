import {
  applyRsvpDelights,
  decodeMatchedGuestHeader,
  getGuestQueryFromUrl,
  initRsvpPreviewIfRequested,
  persistThanksDelightOnSubmit,
  resetRsvpDelights,
} from "./easter-eggs";
import { dynamicCopy, getCurrentLocale } from "./i18n";

const WORKER_URL =
  import.meta.env.VITE_RSVP_WORKER_URL ||
  "https://wedding-rsvp-worker.lucasaffalter.workers.dev/";

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  const locale = getCurrentLocale();
  const copy = dynamicCopy[locale].rsvp;

  const searchStep = document.getElementById("rsvp-search-step");
  const searchForm = document.getElementById("rsvp-search-form") as HTMLFormElement | null;
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
  const dietaryInput = document.getElementById("dietary") as HTMLTextAreaElement | null;
  const step2Heading = document.getElementById("rsvp-step2-heading") as HTMLElement | null;

  let currentParty: string[] = [];
  let currentSubmittedBy = "";

  function resetInteractiveLocks(): void {
    const findSpinner = btnFindInvitation?.querySelector(".spinner") as HTMLElement | null;
    if (findSpinner) findSpinner.style.display = "none";
    if (btnFindInvitation) btnFindInvitation.disabled = false;

    const submitSpinner = btnSubmitRsvp?.querySelector(".spinner") as HTMLElement | null;
    if (submitSpinner) submitSpinner.style.display = "none";
    if (btnSubmitRsvp) btnSubmitRsvp.disabled = false;
    if (btnBackSearch) btnBackSearch.disabled = false;
  }

  // Prevent frozen disabled buttons if user navigates back from thanks.html via bfcache
  window.addEventListener("pageshow", () => {
    resetInteractiveLocks();
  });

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

  if (emailInput) {
    emailInput.addEventListener("input", () => {
      emailInput.removeAttribute("aria-invalid");
      if (submitError && submitError.textContent === copy.invalidEmail) {
        submitError.style.display = "none";
      }
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (submitError) submitError.style.display = "none";

      // 1. Verify every party member has an explicit selection
      const partyPayload: Array<{ name: string; status: string; attending: boolean }> = [];
      for (let idx = 0; idx < currentParty.length; idx++) {
        const selected = rsvpForm.querySelector(
          `input[name="attending_${idx}"]:checked`
        ) as HTMLInputElement | null;
        if (!selected) {
          showSubmitError(copy.missingAttendance);
          const firstRadio = rsvpForm.querySelector(
            `input[name="attending_${idx}"]`
          ) as HTMLInputElement | null;
          firstRadio?.focus();
          return;
        }
        const isAccepting = !selected.value.toLowerCase().includes("decline");
        partyPayload.push({
          name: currentParty[idx],
          status: isAccepting ? "Joyfully Accept" : "Regretfully Decline",
          attending: isAccepting,
        });
      }

      // 2. Validate optional email format (catches missing TLD like "name@gmail")
      const cleanEmail = emailInput?.value.trim() || "";
      if (emailInput) {
        emailInput.value = cleanEmail;
      }
      if (cleanEmail && !STRICT_EMAIL_REGEX.test(cleanEmail)) {
        emailInput?.setAttribute("aria-invalid", "true");
        showSubmitError(copy.invalidEmail);
        emailInput?.focus();
        return;
      }

      // 3. Collect any extra easter-egg fields injected into #rsvp-form
      const KNOWN_FORM_KEYS = new Set([
        "_next",
        "lang",
        "party_members",
        "submitted_by",
        "email",
        "message",
        "dietary",
      ]);
      const formData = new FormData(rsvpForm);
      const extras: Record<string, string> = {};
      for (const [key, val] of formData.entries()) {
        if (
          KNOWN_FORM_KEYS.has(key) ||
          key.startsWith("attending_") ||
          key.startsWith("guest_name_")
        ) {
          continue;
        }
        if (typeof val === "string" && val.trim()) {
          extras[key] = val.trim();
        }
      }

      const spinner = btnSubmitRsvp?.querySelector(".spinner") as HTMLElement | null;
      if (spinner) spinner.style.display = "inline-block";
      if (btnSubmitRsvp) btnSubmitRsvp.disabled = true;
      if (btnBackSearch) btnBackSearch.disabled = true;

      try {
        const submitEndpoint = WORKER_URL.endsWith("/")
          ? `${WORKER_URL}submit`
          : `${WORKER_URL}/submit`;

        const payload = {
          party: partyPayload,
          submittedBy: currentSubmittedBy || undefined,
          email: cleanEmail || undefined,
          dietary: dietaryInput?.value.trim() || undefined,
          lang: locale,
          ...(Object.keys(extras).length > 0 ? { extras } : {}),
        };

        const response = await fetch(submitEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });

        let resultData: { success?: boolean; error?: string } | null = null;
        try {
          resultData = (await response.json()) as { success?: boolean; error?: string };
        } catch {
          resultData = null;
        }

        if (response.ok && resultData?.success !== false) {
          const anyAttending = partyPayload.some((p) => p.attending);
          persistThanksDelightOnSubmit(rsvpForm, anyAttending);
          const nextUrl = locale === "es" ? "/es/thanks.html" : "/thanks.html";
          window.location.href = nextUrl;
          return;
        } else {
          showSubmitError(copy.serverError);
        }
      } catch {
        showSubmitError(copy.networkError);
      }

      resetInteractiveLocks();
    });
  }

  async function runInvitationLookup(): Promise<void> {
    if (!firstNameInput || !lastNameInput || !btnFindInvitation) return;

    let first = firstNameInput.value.trim();
    let last = lastNameInput.value.trim();

    // Handle mobile autofill putting full name ("First Last") into first-name input
    if (first && !last) {
      const parts = first.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        first = parts[0];
        last = parts.slice(1).join(" ");
        firstNameInput.value = first;
        lastNameInput.value = last;
      }
    }

    if (!first || !last) {
      showError(copy.missingFields);
      if (!first) firstNameInput.focus();
      else lastNameInput.focus();
      return;
    }

    const spinner = btnFindInvitation.querySelector(".spinner") as HTMLElement | null;
    if (spinner) spinner.style.display = "inline-block";
    btnFindInvitation.disabled = true;
    if (searchError) searchError.style.display = "none";

    try {
      const lookupBase = WORKER_URL.endsWith("/") ? WORKER_URL : `${WORKER_URL}/`;
      const response = await fetch(
        `${lookupBase}?first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (response.ok) {
        const party = (await response.json()) as string[];
        const headerMatchedGuest = decodeMatchedGuestHeader(response);
        const submittedBy = headerMatchedGuest || resolveSubmittedBy(first, last, party);
        setupRsvpForm(party, submittedBy, response);
      } else if (response.status === 404) {
        showError(copy.notFound);
      } else {
        showError(copy.serverError);
      }
    } catch {
      showError(copy.networkError);
    } finally {
      if (spinner) spinner.style.display = "none";
      btnFindInvitation.disabled = false;
    }
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void runInvitationLookup();
    });
  } else if (btnFindInvitation) {
    btnFindInvitation.addEventListener("click", () => {
      void runInvitationLookup();
    });
  }

  if (btnBackSearch && rsvpForm && searchStep) {
    btnBackSearch.addEventListener("click", () => {
      if (submitError) submitError.style.display = "none";
      resetRsvpDelights();
      rsvpForm.reset();
      currentParty = [];
      currentSubmittedBy = "";
      rsvpForm.style.display = "none";
      searchStep.style.display = "block";
      firstNameInput?.focus();
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

    // Clean up any previous party's state, notes, or input values before populating
    resetRsvpDelights();
    rsvpForm.reset();
    emailInput?.removeAttribute("aria-invalid");
    if (submitError) submitError.style.display = "none";

    currentParty = [...party];
    currentSubmittedBy = submittedBy;

    guestRowsContainer.innerHTML = "";
    partyListHiddenInput.value = party.join(", ");
    if (submittedByHiddenInput) {
      submittedByHiddenInput.value = submittedBy;
    }
    const langHiddenInput = rsvpForm.querySelector('input[name="lang"]') as HTMLInputElement | null;
    if (langHiddenInput) {
      langHiddenInput.value = locale;
    }

    party.forEach((guest, idx) => {
      const safeName = escapeHtml(guest);
      const rowHtml = `
        <fieldset class="guest-rsvp-row">
          <legend class="guest-name-label">${safeName}</legend>
          <input type="hidden" name="guest_name_${idx}" value="${safeName}">
          <div class="guest-options-group">
            <label class="radio-option">
              <input type="radio" name="attending_${idx}" value="Joyfully Accept" required>
              <span>${escapeHtml(copy.acceptLabel)}</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="attending_${idx}" value="Regretfully Decline">
              <span>${escapeHtml(copy.declineLabel)}</span>
            </label>
          </div>
        </fieldset>
      `;
      guestRowsContainer.insertAdjacentHTML("beforeend", rowHtml);
    });

    guestRowsContainer.addEventListener(
      "change",
      () => {
        if (submitError && submitError.textContent === copy.missingAttendance) {
          submitError.style.display = "none";
        }
      },
      { once: false }
    );

    searchStep.style.display = "none";
    rsvpForm.style.display = "block";
    step2Heading?.focus();

    applyRsvpDelights({
      response,
      party,
      submittedBy,
      locale,
      formElement: rsvpForm,
    });
  }

  const guestQuery = getGuestQueryFromUrl();
  if (guestQuery && firstNameInput && lastNameInput) {
    firstNameInput.value = guestQuery.first;
    lastNameInput.value = guestQuery.last;
    void runInvitationLookup();
  } else {
    initRsvpPreviewIfRequested({
      locale,
      onPreviewParty: (party, submittedBy) => setupRsvpForm(party, submittedBy),
    });
  }
});
