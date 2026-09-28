import { Ingredient, Recipe, RecipeStep } from '../types/recipe.ts';

export const INGREDIENT_CATEGORIES: Ingredient['category'][] = [
  'Produce',
  'Dairy & Refrigerated',
  'Meat & Seafood',
  'Pantry & Spices',
  'Bakery',
  'Frozen',
  'Other',
];

const DIFFICULTIES: Recipe['difficulty'][] = ['Easy', 'Intermediate', 'Advanced'];

/** JSON schema handed to Gemini so it must return exactly this shape. */
export const RECIPE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    foundRecipe: {
      type: 'boolean',
      description: 'False when the source does not actually contain a recipe (no ingredients or method).',
    },
    title: { type: 'string' },
    description: { type: 'string', description: 'One or two sentences describing the dish, based only on the source.' },
    prepTimeMinutes: { type: 'number', description: 'Minutes. Use 0 when the source does not say.' },
    cookTimeMinutes: { type: 'number', description: 'Minutes. Use 0 when the source does not say.' },
    totalTimeMinutes: { type: 'number', description: 'Minutes. Use 0 when the source does not say.' },
    defaultServings: { type: 'number', description: 'Servings the recipe makes. Use 0 when the source does not say.' },
    cuisine: { type: 'string' },
    difficulty: { type: 'string', enum: DIFFICULTIES },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Clean item name without quantity or preparation.' },
          amount: { type: 'number', description: 'Numeric quantity. Use 0 when no quantity is given (for example "to taste").' },
          unit: { type: 'string', description: 'Standard unit such as cup, tbsp, tsp, g, oz, lb, clove. Empty when none.' },
          notes: { type: 'string', description: 'Preparation such as diced or chilled. Empty when none.' },
          category: { type: 'string', enum: INGREDIENT_CATEGORIES },
          instacartQuery: { type: 'string', description: 'A short grocery search phrase for this ingredient.' },
        },
        required: ['name', 'amount', 'unit', 'category'],
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Two to four word label for the step.' },
          instruction: { type: 'string', description: 'One clear action.' },
          timerSeconds: { type: 'number', description: 'Seconds to wait if the step is timed, otherwise 0.' },
          temperature: { type: 'string', description: 'Only if the source states one, for example "375°F / 190°C".' },
          tips: { type: 'string' },
          stepIngredients: { type: 'array', items: { type: 'string' } },
        },
        required: ['instruction'],
      },
    },
  },
  required: ['foundRecipe', 'title', 'ingredients', 'steps'],
} as const;

export class RecipeParseError extends Error {
  constructor(message: string, readonly code: 'no_recipe' | 'invalid') {
    super(message);
  }
}

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const asCategory = (value: unknown): Ingredient['category'] => {
  const text = asString(value).toLowerCase();
  return INGREDIENT_CATEGORIES.find((c) => c.toLowerCase() === text) ?? 'Other';
};

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export type ParsedRecipeFields = Omit<Recipe, 'id' | 'source' | 'heroImage' | 'createdAt' | 'updatedAt'>;

/**
 * Turns raw model output into a well-formed recipe. Never invents content: missing numbers
 * stay 0/null so the review screen can flag them for the user.
 */
export function normalizeParsedRecipe(raw: unknown): ParsedRecipeFields {
  if (!raw || typeof raw !== 'object') {
    throw new RecipeParseError('The AI response could not be read. Try again.', 'invalid');
  }
  const data = raw as Record<string, any>;
  if (data.foundRecipe === false) {
    throw new RecipeParseError('No recipe was found there. Check the link, or paste the recipe text instead.', 'no_recipe');
  }

  const ingredients: Ingredient[] = (Array.isArray(data.ingredients) ? data.ingredients : [])
    .map((ing: any): Ingredient | null => {
      const name = asString(ing?.name);
      if (!name) return null;
      const amount = asNumber(ing?.amount);
      const notes = asString(ing?.notes);
      const instacartQuery = asString(ing?.instacartQuery);
      return {
        id: newId('ing'),
        name,
        amount: amount > 0 ? amount : null,
        unit: asString(ing?.unit),
        category: asCategory(ing?.category),
        ...(notes ? { notes } : {}),
        ...(instacartQuery ? { instacartQuery } : {}),
      };
    })
    .filter((ing: Ingredient | null): ing is Ingredient => ing !== null);

  const steps: RecipeStep[] = (Array.isArray(data.steps) ? data.steps : [])
    .map((step: any) => ({
      instruction: asString(step?.instruction),
      title: asString(step?.title),
      timer: Math.round(asNumber(step?.timerSeconds)),
      temperature: asString(step?.temperature),
      tips: asString(step?.tips),
      stepIngredients: Array.isArray(step?.stepIngredients)
        ? step.stepIngredients.map(asString).filter(Boolean)
        : [],
    }))
    .filter((step) => step.instruction)
    .map((step, index): RecipeStep => ({
      stepNumber: index + 1,
      instruction: step.instruction,
      ...(step.title ? { title: step.title } : {}),
      ...(step.timer > 0 ? { timerSeconds: step.timer } : {}),
      ...(step.temperature ? { temperature: step.temperature } : {}),
      ...(step.tips ? { tips: step.tips } : {}),
      ...(step.stepIngredients.length ? { stepIngredients: step.stepIngredients } : {}),
    }));

  const title = asString(data.title);
  if (!title || (ingredients.length === 0 && steps.length === 0)) {
    throw new RecipeParseError('No recipe was found there. Check the link, or paste the recipe text instead.', 'no_recipe');
  }

  const prep = asNumber(data.prepTimeMinutes);
  const cook = asNumber(data.cookTimeMinutes);
  const difficulty = DIFFICULTIES.find((d) => d.toLowerCase() === asString(data.difficulty).toLowerCase());

  return {
    title,
    description: asString(data.description),
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: Math.max(asNumber(data.totalTimeMinutes), prep + cook),
    defaultServings: Math.round(asNumber(data.defaultServings)) || 4,
    cuisine: asString(data.cuisine) || 'Other',
    difficulty: difficulty ?? 'Intermediate',
    ingredients,
    steps,
  };
}

/** Returns a user-facing problem with a recipe, or null when it is safe to save. */
export function validateRecipeForSave(recipe: Recipe): string | null {
  if (!recipe.title.trim()) return 'Add a recipe title before saving.';
  if (recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    return 'Keep at least one ingredient and one step before saving.';
  }
  if (recipe.ingredients.some((ing) => !ing.name.trim())) {
    return 'Name every ingredient, or remove the blank rows.';
  }
  if (recipe.steps.some((step) => !step.instruction.trim())) {
    return 'Add instructions to every step, or remove the blank rows.';
  }
  return null;
}

/** Trims fields and renumbers steps; call right before saving an edited recipe. */
export function cleanRecipeForSave(recipe: Recipe): Recipe {
  return {
    ...recipe,
    title: recipe.title.trim(),
    description: recipe.description.trim(),
    cuisine: recipe.cuisine.trim() || 'Other',
    heroImage: recipe.heroImage.trim(),
    totalTimeMinutes: Math.max(recipe.totalTimeMinutes, recipe.prepTimeMinutes + recipe.cookTimeMinutes),
    ingredients: recipe.ingredients.map((ing) => ({ ...ing, name: ing.name.trim(), unit: ing.unit.trim() })),
    steps: recipe.steps.map((step, index) => ({
      ...step,
      stepNumber: index + 1,
      title: step.title?.trim() || undefined,
      instruction: step.instruction.trim(),
    })),
    updatedAt: new Date().toISOString(),
  };
}
