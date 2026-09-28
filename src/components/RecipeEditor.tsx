import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Ingredient, Recipe, RecipeStep } from '../types/recipe.ts';
import { INGREDIENT_CATEGORIES } from '../utils/recipeSchema.ts';

interface RecipeEditorProps {
  recipe: Recipe;
  onChange: (recipe: Recipe) => void;
}

const parseNumberInput = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getRecipeReviewWarnings = (recipe: Recipe): string[] =>
  [
    !recipe.title.trim() ? 'Missing title' : null,
    recipe.defaultServings <= 0 ? 'Servings need review' : null,
    recipe.ingredients.length === 0 ? 'No ingredients found' : null,
    recipe.steps.length === 0 ? 'No steps found' : null,
    recipe.ingredients.some((ing) => ing.amount === null && ing.unit === '') && recipe.ingredients.length > 0
      ? 'Some ingredients have no quantity'
      : null,
    recipe.prepTimeMinutes + recipe.cookTimeMinutes === 0 ? 'No prep or cook time listed' : null,
  ].filter(Boolean) as string[];

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-stone-600';
const inputClass =
  'px-3 min-h-11 bg-surface border rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40';
const borderFor = (missing: boolean) => (missing ? 'border-amber-500' : 'border-stone-300');

export const RecipeEditor: React.FC<RecipeEditorProps> = ({ recipe, onChange }) => {
  const update = (updates: Partial<Recipe>) => onChange({ ...recipe, ...updates });

  const updateIngredient = (index: number, updates: Partial<Ingredient>) => {
    const ingredients = [...recipe.ingredients];
    ingredients[index] = { ...ingredients[index], ...updates };
    update({ ingredients });
  };

  const updateStep = (index: number, updates: Partial<RecipeStep>) => {
    const steps = [...recipe.steps];
    steps[index] = { ...steps[index], ...updates };
    update({ steps });
  };

  const addIngredient = () =>
    update({
      ingredients: [
        ...recipe.ingredients,
        { id: `ing-${crypto.randomUUID()}`, name: '', amount: null, unit: '', category: 'Other' },
      ],
    });

  const removeIngredient = (index: number) =>
    update({ ingredients: recipe.ingredients.filter((_, i) => i !== index) });

  const addStep = () =>
    update({ steps: [...recipe.steps, { stepNumber: recipe.steps.length + 1, title: '', instruction: '' }] });

  const removeStep = (index: number) =>
    update({
      steps: recipe.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, stepNumber: i + 1 })),
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={labelClass}>Title</span>
          <input
            value={recipe.title}
            onChange={(e) => update({ title: e.target.value })}
            className={`${inputClass} ${borderFor(!recipe.title.trim())}`}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={labelClass}>Description</span>
          <textarea
            rows={2}
            value={recipe.description}
            onChange={(e) => update({ description: e.target.value })}
            className={`${inputClass} border-stone-300 py-2`}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={labelClass}>Photo link (optional)</span>
          <input
            type="url"
            inputMode="url"
            value={recipe.heroImage}
            onChange={(e) => update({ heroImage: e.target.value })}
            placeholder="https://…"
            className={`${inputClass} border-stone-300`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Cuisine</span>
          <input value={recipe.cuisine} onChange={(e) => update({ cuisine: e.target.value })} className={`${inputClass} border-stone-300`} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Servings</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={recipe.defaultServings}
            onChange={(e) => update({ defaultServings: Number(e.target.value) || 1 })}
            className={`${inputClass} border-stone-300`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Prep minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={recipe.prepTimeMinutes}
            onChange={(e) => {
              const prepTimeMinutes = Number(e.target.value) || 0;
              update({ prepTimeMinutes, totalTimeMinutes: prepTimeMinutes + recipe.cookTimeMinutes });
            }}
            className={`${inputClass} border-stone-300`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Cook minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={recipe.cookTimeMinutes}
            onChange={(e) => {
              const cookTimeMinutes = Number(e.target.value) || 0;
              update({ cookTimeMinutes, totalTimeMinutes: recipe.prepTimeMinutes + cookTimeMinutes });
            }}
            className={`${inputClass} border-stone-300`}
          />
        </label>
      </div>

      <section className="flex flex-col gap-2" aria-label="Ingredients">
        <div className="flex items-center justify-between gap-3">
          <h4 className={labelClass}>Ingredients</h4>
          <button
            type="button"
            onClick={addIngredient}
            className="inline-flex items-center gap-1 min-h-11 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-50 rounded-xl dark:hover:bg-amber-950/40 dark:text-amber-200"
          >
            <Plus className="w-4 h-4" />
            Add ingredient
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recipe.ingredients.map((ingredient, index) => (
            <div key={ingredient.id} className="grid grid-cols-12 gap-2 p-2.5 bg-surface border border-stone-200 rounded-2xl">
              <input
                aria-label="Quantity"
                inputMode="decimal"
                value={ingredient.amount ?? ''}
                onChange={(e) => updateIngredient(index, { amount: parseNumberInput(e.target.value) })}
                className={`${inputClass} border-stone-300 col-span-3 min-w-0`}
                placeholder="Qty"
              />
              <input
                aria-label="Unit"
                value={ingredient.unit}
                onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                className={`${inputClass} border-stone-300 col-span-4 min-w-0`}
                placeholder="Unit"
              />
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                aria-label={`Remove ${ingredient.name || 'ingredient'}`}
                className="col-span-5 sm:col-span-5 justify-self-end min-h-11 min-w-11 inline-flex items-center justify-center text-stone-500 hover:text-rose-600 rounded-xl dark:hover:text-rose-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <input
                aria-label="Ingredient name"
                value={ingredient.name}
                onChange={(e) => updateIngredient(index, { name: e.target.value })}
                className={`${inputClass} col-span-12 ${borderFor(!ingredient.name.trim())}`}
                placeholder="Ingredient"
              />
              <select
                aria-label="Store aisle"
                value={ingredient.category}
                onChange={(e) => updateIngredient(index, { category: e.target.value as Ingredient['category'] })}
                className={`${inputClass} border-stone-300 col-span-12 bg-stone-50`}
              >
                {INGREDIENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label="Steps">
        <div className="flex items-center justify-between gap-3">
          <h4 className={labelClass}>Steps</h4>
          <button
            type="button"
            onClick={addStep}
            className="inline-flex items-center gap-1 min-h-11 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-50 rounded-xl dark:hover:bg-amber-950/40 dark:text-amber-200"
          >
            <Plus className="w-4 h-4" />
            Add step
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recipe.steps.map((step, index) => (
            <div key={index} className="p-3 bg-surface border border-stone-200 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-ink text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <input
                  aria-label={`Step ${index + 1} title`}
                  value={step.title || ''}
                  onChange={(e) => updateStep(index, { title: e.target.value })}
                  className={`${inputClass} border-stone-300 flex-1 min-w-0`}
                  placeholder="Step title (optional)"
                />
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  aria-label={`Remove step ${index + 1}`}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center text-stone-500 hover:text-rose-600 rounded-xl dark:hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                aria-label={`Step ${index + 1} instructions`}
                rows={3}
                value={step.instruction}
                onChange={(e) => updateStep(index, { instruction: e.target.value })}
                className={`${inputClass} py-2 ${borderFor(!step.instruction.trim())}`}
                placeholder="What to do"
              />
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <span>Timer (seconds)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={step.timerSeconds ?? ''}
                  onChange={(e) => updateStep(index, { timerSeconds: parseNumberInput(e.target.value) || undefined })}
                  className={`${inputClass} border-stone-300 w-28`}
                  placeholder="None"
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
