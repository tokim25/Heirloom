import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  Users,
  Flame,
  Play,
  ShoppingBag,
  Share2,
  ExternalLink,
  ChevronDown,
  Trash2,
  ListPlus,
  Pencil,
  Plus,
  Minus,
  Check,
  Youtube,
  Sparkles,
  AlertCircle,
  ChefHat,
} from 'lucide-react';
import { Recipe, Ingredient, GroceryList } from '../types/recipe.ts';
import { scaleQuantity, formatFraction, convertUnit, UnitSystem, formatStepTemperatures } from '../utils/units.ts';
import { ConfirmSheet, Sheet } from './ui/Sheet.tsx';

export interface AddToGroceryListResult {
  success: boolean;
  message: string;
  listId?: string;
  listTitle?: string;
}

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
  onStartCooking: (recipe: Recipe, servings: number, unitSystem: UnitSystem) => void;
  onOpenInstacart: (recipe: Recipe, servings: number) => void;
  onAddAllToGroceryList: (recipe: Recipe, servings: number, listId?: string) => Promise<AddToGroceryListResult>;
  groceryLists?: GroceryList[];
  currentListId?: string;
  onViewGroceryList?: () => void;
  onDeleteRecipe?: (id: string) => void;
  onEditRecipe?: (recipe: Recipe) => void;
  onShareRecipe?: (recipe: Recipe) => void;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  onClose,
  onStartCooking,
  onOpenInstacart,
  onAddAllToGroceryList,
  groceryLists = [],
  currentListId,
  onViewGroceryList,
  onDeleteRecipe,
  onEditRecipe,
  onShareRecipe,
}) => {
  const [servings, setServings] = useState(recipe.defaultServings || 2);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial');
  const [selectedListId, setSelectedListId] = useState(currentListId || groceryLists[0]?.id || '');
  const [addListStatus, setAddListStatus] = useState<AddToGroceryListResult | null>(null);
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [recipe.heroImage]);

  const handleAddGroceries = async () => {
    setIsAddingToList(true);
    setAddListStatus(null);
    const result = await onAddAllToGroceryList(recipe, servings, selectedListId || undefined);
    setAddListStatus(result);
    setIsAddingToList(false);
    if (result.success) {
      setTimeout(() => setAddListStatus(null), 3500);
    }
  };

  // Group ingredients by category
  const categorizedIngredients = recipe.ingredients.reduce<Record<string, Ingredient[]>>((acc, ing) => {
    const cat = ing.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ing);
    return acc;
  }, {});

  const facts = [
    { label: 'Prep', value: `${recipe.prepTimeMinutes} min` },
    { label: 'Cook', value: `${recipe.cookTimeMinutes} min` },
    { label: 'Total', value: `${recipe.totalTimeMinutes} min` },
    ...(recipe.nutrition?.calories ? [{ label: 'Calories', value: `${recipe.nutrition.calories} kcal` }] : []),
  ];

  return (
    <Sheet open onClose={onClose} title={recipe.title} variant="bare" size="4xl" fullOnMobile>
      {/* Floating Edit and Close buttons, clear of the iPhone notch */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-30 flex items-center gap-2">
        {onShareRecipe && (
          <button
            type="button"
            onClick={() => onShareRecipe(recipe)}
            aria-label="Share recipe"
            title="Share recipe"
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-ink/70 hover:bg-ink text-white backdrop-blur-md transition-all shadow-md"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        {onEditRecipe && (
          <button
            type="button"
            onClick={() => onEditRecipe(recipe)}
            className="min-h-11 px-4 inline-flex items-center gap-1.5 rounded-full bg-ink/70 hover:bg-ink text-white text-sm font-semibold backdrop-blur-md transition-all shadow-md"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-ink/70 hover:bg-ink text-white backdrop-blur-md transition-all shadow-md"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Everything scrolls together, so the picture moves out of the way as you read */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="relative h-56 sm:h-80 w-full overflow-hidden bg-stone-200">
          {recipe.heroImage && !imageFailed ? (
            <img
              src={recipe.heroImage}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-50 via-stone-100 to-stone-300 flex items-center justify-center">
              <ChefHat className="w-14 h-14 text-amber-800/60" aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

          <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-8 sm:right-8 text-white flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90">
              <span className="font-semibold">{recipe.cuisine}</span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span>{recipe.difficulty}</span>
              {recipe.source.sharedBy && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span>Shared by {recipe.source.sharedBy}</span>
                </>
              )}
              {recipe.source.url && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <a
                    href={recipe.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-white"
                  >
                    {recipe.source.type === 'youtube' ? (
                      <Youtube className="w-4 h-4 text-red-300" aria-hidden="true" />
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{recipe.source.type === 'youtube' ? 'Watch video' : recipe.source.sourceName || 'Original'}</span>
                  </a>
                </>
              )}
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight leading-tight">{recipe.title}</h1>
          </div>
        </div>

        <div className="px-5 sm:px-8 py-6 flex flex-col gap-8">
          {/* Quick facts */}
          <dl className="flex items-stretch divide-x divide-stone-200 border-y border-stone-200/80 py-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex-1 px-3 first:pl-0 last:pr-0 text-center sm:text-left">
                <dt className="text-xs font-medium text-stone-600 uppercase tracking-wider">{fact.label}</dt>
                <dd className="text-lg font-serif text-stone-900 tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {recipe.description && <p className="text-stone-700 text-base leading-relaxed">{recipe.description}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Ingredients, with servings and units right where they apply */}
            <section className="lg:col-span-5 flex flex-col gap-4" aria-labelledby="ingredients-heading">
              <h2 id="ingredients-heading" className="font-serif text-2xl text-stone-900 font-medium">
                Ingredients
              </h2>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-stone-100 rounded-xl border border-stone-200/70" role="group" aria-label="Servings">
                  <button
                    type="button"
                    onClick={() => setServings((prev) => Math.max(1, prev - 1))}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-stone-700 hover:bg-surface active:bg-surface"
                    aria-label="Fewer servings"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-20 text-center text-sm font-semibold text-stone-900" aria-live="polite">
                    {servings} {servings === 1 ? 'serving' : 'servings'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setServings((prev) => prev + 1)}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-stone-700 hover:bg-surface active:bg-surface"
                    aria-label="More servings"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex items-center bg-stone-100 rounded-xl border border-stone-200/70 p-1" role="group" aria-label="Units">
                  {(['imperial', 'metric'] as const).map((system) => (
                    <button
                      key={system}
                      type="button"
                      onClick={() => setUnitSystem(system)}
                      aria-pressed={unitSystem === system}
                      className={`min-h-9 px-3 text-sm font-medium rounded-lg transition-all ${
                        unitSystem === system ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {system === 'imperial' ? 'US' : 'Metric'}
                    </button>
                  ))}
                </div>
              </div>

              {groceryLists.length > 1 && (
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="shrink-0">Add to list</span>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="flex-1 min-w-0 min-h-11 px-3 rounded-xl bg-surface border border-stone-300 text-sm font-medium text-stone-800"
                  >
                    {groceryLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-col gap-5">
                {Object.entries(categorizedIngredients).map(([category, items]) => (
                  <div key={category} className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600">{category}</h3>
                    <ul className="divide-y divide-stone-100 bg-surface rounded-2xl border border-stone-200/80 px-2 shadow-xs">
                      {items.map((ing) => {
                        const scaled = scaleQuantity(ing.amount, recipe.defaultServings, servings);
                        const converted = convertUnit(scaled, ing.unit, ing.name, unitSystem);
                        const displayQty = formatFraction(converted.amount);

                        return (
                          <li key={ing.id} className="py-3 px-2 flex items-baseline gap-2 text-base">
                            <span className="font-semibold text-stone-900 whitespace-nowrap">
                              {displayQty ? `${displayQty} ${converted.unit}` : converted.unit}
                            </span>
                            <span className="text-stone-800">
                              {ing.name}
                              {ing.notes && <span className="text-stone-600 text-sm italic"> ({ing.notes})</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Method */}
            <section className="lg:col-span-7 flex flex-col gap-4" aria-labelledby="method-heading">
              <div className="flex items-baseline justify-between">
                <h2 id="method-heading" className="font-serif text-2xl text-stone-900 font-medium">
                  Method
                </h2>
                <span className="text-sm text-stone-600">{recipe.steps.length} steps</span>
              </div>

              <ol className="flex flex-col gap-3">
                {recipe.steps.map((step, idx) => (
                  <li key={step.stepNumber} className="p-4 rounded-2xl bg-surface border border-stone-200/80 shadow-xs flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 shrink-0 rounded-full bg-ink text-white text-sm font-medium flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h3 className="font-serif text-lg font-medium text-stone-900">{step.title || `Step ${idx + 1}`}</h3>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                        {step.timerSeconds ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/50">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                            {Math.round(step.timerSeconds / 60)} min
                          </span>
                        ) : null}
                        {step.temperature && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-medium">
                            <Flame className="w-3 h-3 text-amber-500" aria-hidden="true" />
                            {step.temperature}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-base text-stone-700 leading-relaxed">
                      {formatStepTemperatures(step.instruction, unitSystem)}
                    </p>

                    {step.tips && (
                      <div className="text-sm text-amber-900 bg-amber-50/70 p-3 rounded-xl border border-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900/40">
                        <span className="font-semibold">Tip: </span>
                        {step.tips}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {onDeleteRecipe && (
            <div className="pt-4 border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm text-rose-700 hover:text-rose-800 hover:underline dark:text-rose-300 dark:hover:text-rose-200"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Delete recipe</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sticky actions: the one thing you came to do, always in reach */}
      <div className="shrink-0 bg-surface/95 backdrop-blur border-t border-stone-200">
        {addListStatus && (
          <div
            role="status"
            className={`mx-4 mt-3 text-sm rounded-xl px-3 py-2 flex items-center justify-between gap-3 ${
              addListStatus.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/50'
                : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/50'
            }`}
          >
            <span>{addListStatus.message}</span>
            {onViewGroceryList && (
              <button
                type="button"
                onClick={onViewGroceryList}
                className="min-h-11 font-semibold underline underline-offset-2 shrink-0"
              >
                {addListStatus.success ? 'View list' : 'Open groceries'}
              </button>
            )}
          </div>
        )}
        <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => onStartCooking(recipe, servings, unitSystem)}
            className="flex-1 min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-on-accent text-base font-semibold shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            Start cooking
          </button>

          <button
            type="button"
            onClick={handleAddGroceries}
            disabled={isAddingToList}
            aria-label={addListStatus?.success ? 'Added to your list' : 'Add ingredients to grocery list'}
            title="Add ingredients to grocery list"
            className={`min-h-12 min-w-12 sm:px-4 inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all disabled:opacity-60 ${
              addListStatus?.success
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/60'
                : addListStatus
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60'
                : 'bg-surface hover:bg-stone-50 text-stone-800 border-stone-300'
            }`}
          >
            {addListStatus?.success ? (
              <Check className="w-5 h-5" aria-hidden="true" />
            ) : addListStatus ? (
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ListPlus className="w-5 h-5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{isAddingToList ? 'Adding…' : addListStatus?.success ? 'Added' : 'Add to list'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenInstacart(recipe, servings)}
            aria-label="Add to list and shop on Instacart"
            title="Add to list and shop on Instacart"
            className="min-h-12 min-w-12 sm:px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium active:scale-[0.98] transition-all"
          >
            <ShoppingBag className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">Instacart</span>
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={confirmingDelete}
        title={`Delete "${recipe.title}"?`}
        message="This removes the recipe from your cookbook for everyone in your household. This can't be undone."
        confirmLabel="Delete recipe"
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDeleteRecipe?.(recipe.id);
          onClose();
        }}
      />
    </Sheet>
  );
};
