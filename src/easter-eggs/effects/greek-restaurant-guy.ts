import { dynamicCopy } from "../../i18n";
import type { EasterEggModule } from "../types";

/**
 * Easter Egg: "the guy from the greek restaurant"
 * Adds a client-side extra plus-one guest row on the RSVP form for "the guy from the greek restaurant".
 * Not added to the actual canonical RSVP party list, so the submission remains valid while any
 * selection for him is captured in `extras` for the host notification email.
 */
export const greekRestaurantGuyEffect: EasterEggModule = {
  id: "greek_restaurant_guy",
  description:
    "Client-side extra plus one row on the RSVP form for 'the guy from the greek restaurant'.",
  trigger: {
    effectIds: [
      "greek_restaurant_guy",
      "greek_restaurant",
      "guy_from_greek_restaurant",
    ],
    pages: ["rsvp"],
  },
  mount(ctx) {
    const form =
      ctx.formElement ??
      (document.getElementById("rsvp-form") as HTMLFormElement | null);
    const guestRowsContainer =
      (form?.querySelector("#guest-rows-container") as HTMLElement | null) ??
      document.getElementById("guest-rows-container");
    if (!form || !guestRowsContainer) return;

    const existing = document.getElementById("greek-restaurant-guy-row");
    if (existing) {
      existing.remove();
    }

    const copy = dynamicCopy[ctx.locale].rsvp;
    const guestName = "the guy from the greek restaurant";
    const fieldName = "the_guy_from_the_greek_restaurant";

    const fieldset = document.createElement("fieldset");
    fieldset.className = "guest-rsvp-row";
    fieldset.id = "greek-restaurant-guy-row";

    const legend = document.createElement("legend");
    legend.className = "guest-name-label";
    legend.textContent = guestName;

    const optionsGroup = document.createElement("div");
    optionsGroup.className = "guest-options-group";

    const acceptLabel = document.createElement("label");
    acceptLabel.className = "radio-option";
    const acceptRadio = document.createElement("input");
    acceptRadio.type = "radio";
    acceptRadio.name = fieldName;
    acceptRadio.value = "Joyfully Accept";
    const acceptText = document.createElement("span");
    acceptText.textContent = copy.acceptLabel;
    acceptLabel.appendChild(acceptRadio);
    acceptLabel.appendChild(acceptText);

    const declineLabel = document.createElement("label");
    declineLabel.className = "radio-option";
    const declineRadio = document.createElement("input");
    declineRadio.type = "radio";
    declineRadio.name = fieldName;
    declineRadio.value = "Regretfully Decline";
    const declineText = document.createElement("span");
    declineText.textContent = copy.declineLabel;
    declineLabel.appendChild(declineRadio);
    declineLabel.appendChild(declineText);

    optionsGroup.appendChild(acceptLabel);
    optionsGroup.appendChild(declineLabel);

    fieldset.appendChild(legend);
    fieldset.appendChild(optionsGroup);

    guestRowsContainer.appendChild(fieldset);

    return () => {
      fieldset.remove();
    };
  },
};
