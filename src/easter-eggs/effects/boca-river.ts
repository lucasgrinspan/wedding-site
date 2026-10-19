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
    fieldContainer.style.marginTop = "2rem";

    const label = document.createElement("label");
    label.htmlFor = "boca-river-checkbox";
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
    checkbox.id = "boca-river-checkbox";
    checkbox.name = "boca_es_mas_grande";
    checkbox.value = "Sí";
    checkbox.checked = true;
    checkbox.style.accentColor = "var(--primary-color)";
    checkbox.style.width = "1.25rem";
    checkbox.style.height = "1.25rem"; //https://youtube.com
    checkbox.style.cursor = "pointer";

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
      // If user tries to submit during the 2s unchecked window, ensure it's checked
      if (!checkbox.checked) {
        checkbox.checked = true;
      }
    };

    checkbox.addEventListener("change", handleChange);
    form.addEventListener("submit", handleFormSubmit);

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      checkbox.removeEventListener("change", handleChange);
      form.removeEventListener("submit", handleFormSubmit);
      fieldContainer.remove();
    };
  },
};
