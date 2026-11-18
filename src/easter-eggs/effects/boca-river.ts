import type { EasterEggModule } from "../types";

/**
 * Easter Egg: "Boca vs River"
 * Adds an extra field on the RSVP form: "Boca es mas grande que River?"
 * Checkbox is checked by default.
 * When unchecked, waits 2 seconds then automatically re-checks itself.
 */
export const bocaRiverEffect: EasterEggModule = {
  id: "boca_river",
  description:
    "Interactive easter egg: 'Boca es mas grande que River?' checkbox (default checked, re-checks after 2s if unchecked).",
  trigger: {
    effectIds: ["boca_river", "boca_river_checkbox"],
    pages: ["rsvp"],
  },
  mount(ctx) {
    const form =
      ctx.formElement ??
      (document.getElementById("rsvp-form") as HTMLFormElement | null);
    if (!form) return;

    // Remove any previously injected instance to avoid duplicates
    const existing = document.getElementById("boca-river-field");
    if (existing) {
      existing.remove();
    }

    const fieldContainer = document.createElement("div");
    fieldContainer.className = "form-group boca-river-group";
    fieldContainer.id = "boca-river-field";

    const label = document.createElement("label");
    label.htmlFor = "boca-river-checkbox";
    label.className = "checkbox-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "boca-river-checkbox";
    checkbox.name = "boca_es_mas_grande";
    checkbox.value = "Sí";
    checkbox.checked = true;

    const labelText = document.createElement("span");
    labelText.textContent = "Boca es más grande que River?";

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

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = () => {
      if (!checkbox.checked) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          checkbox.checked = true;
        }, 500);
      } else {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    };

    const handleFormSubmit = () => {
      // Ensure it is checked in capture phase BEFORE FormData is read
      if (!checkbox.checked) {
        checkbox.checked = true;
      }
    };

    checkbox.addEventListener("change", handleChange);
    form.addEventListener("submit", handleFormSubmit, { capture: true });

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      checkbox.removeEventListener("change", handleChange);
      form.removeEventListener("submit", handleFormSubmit, { capture: true });
      fieldContainer.remove();
    };
  },
};
