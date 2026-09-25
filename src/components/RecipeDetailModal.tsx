import React, { useState } from 'react';
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
  Plus,
  Minus,
  Check,
  Youtube,
  Sparkles,
} from 'lucide-react';
import { Recipe, Ingredient } from '../types/recipe.ts';
import { scaleQuantity, formatFraction, convertUnit, UnitSystem, formatStepTemperatures } from '../utils/units.ts';

interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
  onStartCooking: (recipe: Recipe, servings: number, unitSystem: UnitSystem) => void;
  onOpenInstacart: (recipe: Recipe, servings: number) => void;
  onAddAllToGroceryList: (recipe: Recipe, servings: number) => void;
  onDeleteRecipe?: (id: string) => void;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  onClose,
  onStartCooking,
  onOpenInstacart,
  onAddAllToGroceryList,
  onDeleteRecipe,
}) => {
  const [servings, setServings] = useState(recipe.defaultServings || 2);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial');
  const [addedToListSuccess, setAddedToListSuccess] = useState(false);

  const handleAddGroceries = () => {
    onAddAllToGroceryList(recipe, servings);
    setAddedToListSuccess(true);
    setTimeout(() => setAddedToListSuccess(false), 2500);
  };

  // Group ingredients by category
  const categorizedIngredients = recipe.ingredients.reduce<Record<string, Ingredient[]>>((acc, ing) => {
    const cat = ing.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ing);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-stone-900/60 hover:bg-stone-900 text-white backdrop-blur-md transition-all shadow-md"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Section */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-stone-200 shrink-0">
          <img
            src={recipe.heroImage}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Hero Content Overlay */}
          <div className="absolute bottom-6 left-6 right-6 text-white flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/90">
              <span className="font-semibold">{recipe.cuisine}</span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span>{recipe.difficulty}</span>
              <span aria-hidden="true" className="text-white/40">·</span>
              <span>{recipe.totalTimeMinutes} min total</span>
              {recipe.source.type === 'youtube' && (
                <>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <a
                    href={recipe.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-red-300 hover:text-white transition-colors underline"
                  >
                    <Youtube className="w-3.5 h-3.5" />
                    <span>Watch video</span>
                  </a>
                </>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight leading-tight">
              {recipe.title}
            </h1>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="bg-white px-6 py-4 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
          {/* Servings Adjuster */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Servings:
            </span>
            <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200/70">
              <button
                onClick={() => setServings((prev) => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg hover:bg-white text-stone-700 hover:text-stone-900 transition-colors"
                title="Decrease Servings"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-semibold text-stone-900">
                {servings}
              </span>
              <button
                onClick={() => setServings((prev) => prev + 1)}
                className="p-1.5 rounded-lg hover:bg-white text-stone-700 hover:text-stone-900 transition-colors"
                title="Increase Servings"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Unit System Switcher */}
            <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200/70">
              <button
                onClick={() => setUnitSystem('imperial')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  unitSystem === 'imperial'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                US (Cups/Oz)
              </button>
              <button
                onClick={() => setUnitSystem('metric')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  unitSystem === 'metric'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Metric (g/ml)
              </button>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStartCooking(recipe, servings, unitSystem)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold shadow-md shadow-amber-500/20 transition-all hover:shadow-lg active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Cook in Stories Mode</span>
            </button>

            <button
              onClick={() => onOpenInstacart(recipe, servings)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-all hover:shadow active:scale-95"
              title="Populate Instacart Cart"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Instacart Cart</span>
            </button>

            <button
              onClick={handleAddGroceries}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                addedToListSuccess
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-300 shadow-sm'
              }`}
            >
              {addedToListSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add to Shared List</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto p-6 sm:p-8 flex flex-col gap-8">
          {/* Quick Metrics Bar (Editorial Hairline Dividers) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4 border-y border-stone-200/80">
            <div>
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Prep Time
              </span>
              <p className="text-xl font-serif text-stone-900 mt-0.5 tabular-nums">
                {recipe.prepTimeMinutes} mins
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Cook Time
              </span>
              <p className="text-xl font-serif text-stone-900 mt-0.5 tabular-nums">
                {recipe.cookTimeMinutes} mins
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Total Time
              </span>
              <p className="text-xl font-serif text-stone-900 mt-0.5 tabular-nums">
                {recipe.totalTimeMinutes} mins
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Calories (Est.)
              </span>
              <p className="text-xl font-serif text-stone-900 mt-0.5 tabular-nums">
                {recipe.nutrition?.calories ? `${recipe.nutrition.calories} kcal` : '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          {recipe.description && (
            <p className="text-stone-700 text-sm sm:text-base leading-relaxed font-normal">
              {recipe.description}
            </p>
          )}

          {/* Split: Ingredients & Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Ingredients (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <h3 className="font-serif text-2xl text-stone-900 font-medium">
                  Ingredients
                </h3>
                <span className="text-xs text-stone-600">
                  Scaled for {servings} {servings === 1 ? 'serving' : 'servings'}
                </span>
              </div>

              <div className="flex flex-col gap-6">
                {Object.entries(categorizedIngredients).map(([category, items]) => (
                  <div key={category} className="flex flex-col gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                      {category}
                    </h4>
                    <ul className="divide-y divide-stone-100 bg-white rounded-2xl border border-stone-200/80 p-2 shadow-xs">
                      {items.map((ing) => {
                        const scaled = scaleQuantity(ing.amount, recipe.defaultServings, servings);
                        const converted = convertUnit(scaled, ing.unit, ing.name, unitSystem);
                        const displayQty = formatFraction(converted.amount);

                        return (
                          <li
                            key={ing.id}
                            className="py-2.5 px-3 flex items-baseline justify-between text-xs sm:text-sm hover:bg-stone-50/80 rounded-xl transition-colors"
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-stone-900 whitespace-nowrap">
                                {displayQty ? `${displayQty} ${converted.unit}` : converted.unit}
                              </span>
                              <span className="text-stone-800">{ing.name}</span>
                              {ing.notes && (
                                <span className="text-stone-600 text-xs italic">
                                  ({ing.notes})
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Step by Step Instructions (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <h3 className="font-serif text-2xl text-stone-900 font-medium">
                  Method
                </h3>
                <span className="text-xs text-stone-600">
                  {recipe.steps.length} steps
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {recipe.steps.map((step, idx) => (
                  <div
                    key={step.stepNumber}
                    className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-col gap-2 hover:border-stone-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-medium flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="font-serif text-lg font-medium text-stone-900">
                          {step.title || `Step ${idx + 1}`}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        {step.timerSeconds && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {Math.round(step.timerSeconds / 60)} min
                          </span>
                        )}
                        {step.temperature && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[11px] font-medium">
                            <Flame className="w-3 h-3 text-amber-500" />
                            {step.temperature}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                      {formatStepTemperatures(step.instruction, unitSystem)}
                    </p>

                    {step.tips && (
                      <div className="text-xs text-amber-800 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 flex items-start gap-1.5">
                        <span className="font-semibold text-amber-900">Tip:</span>
                        <span>{step.tips}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Delete Recipe */}
          {onDeleteRecipe && (
            <div className="pt-6 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => {
                  if (confirm(`Delete "${recipe.title}" from your cookbook?`)) {
                    onDeleteRecipe(recipe.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Recipe from Library</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
