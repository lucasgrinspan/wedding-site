import type { EasterEggModule } from "../types";

export const chickenNuggetsEffect: EasterEggModule = {
  id: 'chicken_nuggets',
  description: 'shows chicken nuggets as requested meal',
  trigger: {
    effectIds: ['chicken_nuggets'],
    pages: ['rsvp'],
  },
  mount(ctx) {
    const foodTextArea = ctx.formElement?.querySelector('textarea#dietary');
    if (!foodTextArea) return;
    (foodTextArea as HTMLTextAreaElement).value = 'chicken nuggets only pls';
  }
}
