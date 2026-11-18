import type { EasterEggModule } from "../types";

export const chickenNuggetsEffect: EasterEggModule = {
  id: "chicken_nuggets",
  description: "shows chicken nuggets as requested meal",
  trigger: {
    effectIds: ["chicken_nuggets"],
    pages: ["rsvp"],
  },
  mount(ctx) {
    const foodTextArea = ctx.formElement?.querySelector(
      "textarea#dietary"
    ) as HTMLTextAreaElement | null;
    if (!foodTextArea) return;
    const previousValue = foodTextArea.value;
    foodTextArea.value = "chicken nuggets only pls";
    return () => {
      if (foodTextArea.value === "chicken nuggets only pls") {
        foodTextArea.value = previousValue;
      }
    };
  },
};
