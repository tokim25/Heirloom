import { Ingredient, RecipeStep } from '../types/recipe.ts';

export const words = (text: string): string[] => text.toLowerCase().match(/[a-z]+/g) ?? [];

/** "tomatoes" and "tomato" both become "tomato", so a step saying "the onions" finds an ingredient called "onion". */
const IRREGULAR: Record<string, string> = { leaves: 'leaf', loaves: 'loaf', halves: 'half' };
export const stem = (word: string): string => {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  return word.length > 3 && word.endsWith('es') ? word.slice(0, -2) : word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
};

/** Words that describe an ingredient without being the ingredient ("fresh", "ground", "thai"), so they never match on their own. */
const MODIFIERS = new Set([
  'fresh', 'ground', 'whole', 'large', 'small', 'medium', 'chopped', 'minced', 'diced', 'sliced', 'dried', 'frozen', 'boneless', 'skinless',
  'extra', 'virgin', 'light', 'dark', 'unsalted', 'salted', 'sweet', 'hot', 'cold', 'warm', 'raw', 'cooked', 'plain', 'thai', 'baby', 'red',
  'green', 'yellow', 'white', 'black', 'brown', 'kosher', 'sea', 'neutral', 'instant', 'bread', 'all', 'purpose', 'flaky', 'toasted',
]);

/**
 * Every ingredient a step uses: the ones the recipe tagged for the step, plus any ingredient the step's own
 * text names. An ingredient counts as named when its whole name appears, or when its last word does ("olive oil"
 * is found by "heat the oil"). Results keep the recipe's ingredient order.
 */
export function ingredientsForStep(ingredients: Ingredient[], step: Pick<RecipeStep, 'title' | 'instruction' | 'stepIngredients'>): Ingredient[] {
  const stepWords = words(`${step.title ?? ''} ${step.instruction}`).map(stem);
  const text = ` ${stepWords.join(' ')} `;
  const tags = (step.stepIngredients ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);

  // The last word of each ingredient's name ("chicken" in "whole chicken"), so a leading word like "chicken" in
  // "chicken stock" does not also claim a step that is about the chicken itself.
  const heads = new Set(ingredients.map((i) => stem(words(i.name).slice(-1)[0] ?? '')).filter(Boolean));

  return ingredients.filter((ing) => {
    const name = ing.name.toLowerCase().trim();
    if (!name) return false;
    if (tags.some((t) => name.includes(t) || t.includes(name))) return true;
    const nameWords = words(name).map(stem);
    if (nameWords.length === 0) return false;
    if (text.includes(` ${nameWords.join(' ')} `)) return true;
    const head = nameWords[nameWords.length - 1];
    if (head.length >= 3 && stepWords.includes(head)) return true;
    // "chicken" finds "chicken thighs" and "basil" finds "Thai basil leaves", unless another ingredient is that word.
    return nameWords
      .slice(0, -1)
      .some((w) => w.length >= 4 && !MODIFIERS.has(w) && stepWords.includes(w) && !heads.has(w));
  });
}
