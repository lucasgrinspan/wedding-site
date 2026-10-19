import type { EasterEggModule } from "../types";

/**
 * Easter Egg: "3s tourney next weekend?"
 * Adds an extra form field on the RSVP form: "3s tourney next weekend?"
 * Checkbox is unchecked by default. Allows guests to sign up for the 3s tourney,
 * logging their response into extras for the host notification email.
 */
export const threesTourneyEffect: EasterEggModule = {
  id: "threes_tourney",
  description:
    "Custom RSVP field: '3s tourney next weekend?' checkbox for guests to sign up.",
  trigger: {
    effectIds: ["threes_tourney", "3s_tourney", "tourney", "threes_tourney_checkbox"],
    pages: ["rsvp"],
  },
  mount(ctx) {
    const form =
      ctx.formElement ??
      (document.getElementById("rsvp-form") as HTMLFormElement | null);
    if (!form) return;

    // Remove any previously injected instance to avoid duplicates
    const existing = document.getElementById("threes-tourney-field");
    if (existing) {
      existing.remove();
    }

    const fieldContainer = document.createElement("div");
    fieldContainer.className = "form-group threes-tourney-group";
    fieldContainer.id = "threes-tourney-field";
    fieldContainer.style.marginTop = "2rem";

    const label = document.createElement("label");
    label.htmlFor = "threes-tourney-checkbox";
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "12px";
    label.style.cursor = "pointer";
    label.style.textTransform = "none";
    label.style.fontFamily = "var(--font-editorial)";
    label.style.fontSize = "1.25rem";
    label.style.color = "var(--primary-color)";
    label.style.marginBottom = "0";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "threes-tourney-checkbox";
    checkbox.name = "threes_tourney_next_weekend";
    checkbox.value = "Yes";
    checkbox.checked = false;
    checkbox.style.accentColor = "var(--primary-color)";
    checkbox.style.width = "1.25rem";
    checkbox.style.height = "1.25rem";
    checkbox.style.cursor = "pointer";

    const labelText = document.createElement("span");
    labelText.textContent = "3s tourney next weekend?";

    label.appendChild(checkbox);
    label.appendChild(labelText);
    fieldContainer.appendChild(label);

    // Insert before submit-error or before the button row
    const submitError = form.querySelector("#submit-error");
    if (submitError) {
      submitError.insertAdjacentElement("beforebegin", fieldContainer);
    } else {
      const submitBtn = document.getElementById("btn-submit-rsvp");
      if (submitBtn?.parentElement) {
        submitBtn.parentElement.insertAdjacentElement("beforebegin", fieldContainer);
      } else {
        form.appendChild(fieldContainer);
      }
    }

    return () => {
      fieldContainer.remove();
    };
  },
};
