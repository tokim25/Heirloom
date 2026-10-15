import { Ingredient, RecipeStep } from '../types/recipe.ts';

const words = (text: string): string[] => text.toLowerCase().match(/[a-z]+/g) ?? [];

/** "tomatoes" and "tomato" both become "tomato", so a step saying "the onions" finds an ingredient called "onion". */
const stem = (word: string): string => (word.length > 3 && word.endsWith('es') ? word.slice(0, -2) : word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

/**
 * Every ingredient a step uses: the ones the recipe tagged for the step, plus any ingredient the step's own
 * text names. An ingredient counts as named when its whole name appears, or when its last word does ("olive oil"
 * is found by "heat the oil"). Results keep the recipe's ingredient order.
 */
export function ingredientsForStep(ingredients: Ingredient[], step: Pick<RecipeStep, 'title' | 'instruction' | 'stepIngredients'>): Ingredient[] {
  const stepWords = words(`${step.title ?? ''} ${step.instruction}`).map(stem);
  const text = ` ${stepWords.join(' ')} `;
  const tags = (step.stepIngredients ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);

  return ingredients.filter((ing) => {
    const name = ing.name.toLowerCase().trim();
    if (!name) return false;
    if (tags.some((t) => name.includes(t) || t.includes(name))) return true;
    const nameWords = words(name).map(stem);
    if (nameWords.length === 0) return false;
    if (text.includes(` ${nameWords.join(' ')} `)) return true;
    const head = nameWords[nameWords.length - 1];
    return head.length >= 3 && stepWords.includes(head);
  });
}
