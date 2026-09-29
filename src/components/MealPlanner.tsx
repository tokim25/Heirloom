import React, { useMemo, useState } from 'react';
import { CalendarDays, ChefHat, ChevronLeft, ChevronRight, Loader2, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { PlannedMeal, Recipe } from '../types/recipe.ts';
import { addDays, dayLabel, fromDateKey, mealsInRange, toDateKey, weekDays, weekLabel, weekStart } from '../utils/mealPlan.ts';
import { compareMostUsed, useLabel } from '../utils/recipeUsage.ts';
import { createRecipeSearchIndex, searchRecipes } from '../utils/searchEngine.ts';
import { Sheet } from './ui/Sheet.tsx';

const Thumb: React.FC<{ url?: string }> = ({ url }) =>
  url ? (
    <img src={url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
  ) : (
    <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
      <ChefHat className="w-5 h-5 text-stone-400" aria-hidden="true" />
    </div>
  );

interface PlanDaySheetProps {
  title: string;
  description?: string;
  confirmLabel: string;
  initialDate?: string;
  initialServings: number;
  meals: PlannedMeal[];
  /** A meal being moved, so it does not count as already planned on its own day. */
  ignoreMealId?: string;
  showServings?: boolean;
  onConfirm: (date: string, servings: number) => void;
  onClose: () => void;
}

const WEEKDAY_INITIAL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_WEEKS_AHEAD = 12;

/** Pick a day from a week strip, see what is already planned on it, and choose how many people you are cooking for. */
export const PlanDaySheet: React.FC<PlanDaySheetProps> = ({
  title,
  description,
  confirmLabel,
  initialDate,
  initialServings,
  meals,
  ignoreMealId,
  showServings = true,
  onConfirm,
  onClose,
}) => {
  const today = toDateKey(new Date());
  const thisWeek = weekStart(today);
  const startDate = initialDate && initialDate >= today ? initialDate : today;
  const [date, setDate] = useState(startDate);
  const [start, setStart] = useState(weekStart(startDate));
  const [servings, setServings] = useState(Math.max(1, initialServings));

  const others = meals.filter((m) => m.id !== ignoreMealId);
  const days = weekDays(start);
  const selectedMeals = others.filter((m) => m.date === date);
  const pick = (day: string) => {
    setDate(day);
    setStart(weekStart(day));
  };
  const longDay = fromDateKey(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 px-4 text-sm font-semibold text-stone-700 hover:text-stone-950 rounded-xl">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(date, servings)}
            className="min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover text-white text-base font-semibold"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2">
        {[
          { label: 'Tonight', day: today },
          { label: 'Tomorrow', day: addDays(today, 1) },
        ].map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => pick(shortcut.day)}
            className={`min-h-11 px-4 rounded-full border text-sm font-semibold transition-colors ${
              date === shortcut.day ? 'bg-ink text-white border-ink' : 'bg-surface border-stone-300 text-stone-800 hover:bg-stone-50'
            }`}
          >
            {shortcut.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous week"
          disabled={start <= thisWeek}
          onClick={() => setStart(addDays(start, -7))}
          className="min-h-11 min-w-11 rounded-full flex items-center justify-center text-stone-800 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-stone-900" aria-live="polite">
          {weekLabel(start)}
        </p>
        <button
          type="button"
          aria-label="Next week"
          disabled={start >= addDays(thisWeek, MAX_WEEKS_AHEAD * 7)}
          onClick={() => setStart(addDays(start, 7))}
          className="min-h-11 min-w-11 rounded-full flex items-center justify-center text-stone-800 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div role="radiogroup" aria-label="Day" className="grid grid-cols-7 gap-1.5 -mt-2">
        {days.map((day, i) => {
          const count = others.filter((m) => m.date === day).length;
          const selected = day === date;
          const past = day < today;
          const dayNumber = fromDateKey(day).getDate();
          return (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={past}
              aria-label={`${fromDateKey(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${
                count ? `, ${count} planned` : ''
              }`}
              onClick={() => pick(day)}
              className={`min-h-16 rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-35 ${
                selected
                  ? 'bg-ink text-white border-ink'
                  : day === today
                  ? 'bg-surface border-amber-500/70 text-stone-900'
                  : 'bg-surface border-stone-300 text-stone-900 hover:bg-stone-50'
              }`}
            >
              <span className={`text-xs font-medium ${selected ? 'text-white/80' : 'text-stone-600'}`}>{WEEKDAY_INITIAL[i]}</span>
              <span className="text-lg font-semibold tabular-nums leading-none">{dayNumber}</span>
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${count ? (selected ? 'bg-white' : 'bg-amber-500') : 'bg-transparent'}`}
              />
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-stone-100/70 px-4 py-3" aria-live="polite">
        <p className="text-sm font-semibold text-stone-900">{longDay}</p>
        {selectedMeals.length === 0 ? (
          <p className="text-sm text-stone-600">Nothing planned yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {selectedMeals.map((m) => (
              <li key={m.id} className="text-sm text-stone-700 truncate">
                {m.recipeTitle} · {m.servings} {m.servings === 1 ? 'person' : 'people'}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showServings && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-stone-900">Cooking for</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Fewer servings"
              onClick={() => setServings((n) => Math.max(1, n - 1))}
              className="hit-area min-h-11 min-w-11 rounded-full border border-stone-300 bg-surface flex items-center justify-center"
            >
              <Minus className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="min-w-20 text-center text-base font-semibold text-stone-900" aria-live="polite">
              {servings} {servings === 1 ? 'person' : 'people'}
            </span>
            <button
              type="button"
              aria-label="More servings"
              onClick={() => setServings((n) => Math.min(24, n + 1))}
              className="hit-area min-h-11 min-w-11 rounded-full border border-stone-300 bg-surface flex items-center justify-center"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
};

interface RecipePickerSheetProps {
  recipes: Recipe[];
  dateLabel: string;
  onPick: (recipe: Recipe) => void;
  onClose: () => void;
}

/** Choose one of your recipes for a day. */
export const RecipePickerSheet: React.FC<RecipePickerSheetProps> = ({ recipes, dateLabel, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const index = useMemo(() => createRecipeSearchIndex(recipes), [recipes]);
  // Typing finds the best match even with typos ("spageti"); with nothing typed, your most used recipes come first.
  const matches = useMemo(() => {
    const q = query.trim();
    return q ? searchRecipes(index, q) : [...recipes].sort(compareMostUsed);
  }, [recipes, query, index]);

  return (
    <Sheet open onClose={onClose} title="Pick a recipe" description={dateLabel} size="md" fullOnMobile>
      <label className="relative block">
        <span className="sr-only">Search your recipes</span>
        <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ingredient or cuisine"
          className="w-full min-h-12 pl-9 pr-3 rounded-xl bg-surface border border-stone-300 text-base text-stone-900 placeholder:text-stone-500"
        />
      </label>
      {recipes.length === 0 ? (
        <p className="text-base text-stone-600">Add a recipe to your cookbook first, then plan it here.</p>
      ) : matches.length === 0 ? (
        <p className="text-base text-stone-600">No recipe matches "{query}".</p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-200">
          {matches.map((recipe) => (
            <li key={recipe.id}>
              <button type="button" onClick={() => onPick(recipe)} className="w-full min-h-16 py-2 flex items-center gap-3 text-left hover:bg-stone-50 rounded-xl">
                <Thumb url={recipe.heroImage} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-stone-900 truncate">{recipe.title}</span>
                  <span className="block text-sm text-stone-600 truncate">
                    {[recipe.cuisine, recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} min` : '', useLabel(recipe) ?? ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
};

interface MealPlannerSheetProps {
  meals: PlannedMeal[];
  recipes: Recipe[];
  onPlan: (recipe: Recipe, date: string, servings: number) => void;
  onMove: (meal: PlannedMeal, date: string, servings: number) => void;
  onRemove: (meal: PlannedMeal) => void;
  /** Adds every meal in the given list to the grocery list, combining repeats. */
  onAddToGroceries: (meals: PlannedMeal[]) => Promise<void>;
  onOpenRecipe: (recipeId: string) => void;
  onViewGroceries: () => void;
  onClose: () => void;
}

/** A week at a glance: what you are cooking each day, with one button to shop for all of it. */
export const MealPlannerSheet: React.FC<MealPlannerSheetProps> = ({
  meals,
  recipes,
  onPlan,
  onMove,
  onRemove,
  onAddToGroceries,
  onOpenRecipe,
  onViewGroceries,
  onClose,
}) => {
  const today = toDateKey(new Date());
  const [start, setStart] = useState(() => weekStart(today));
  const [picking, setPicking] = useState<{ date: string } | { recipe: Recipe; date: string } | null>(null);
  const [moving, setMoving] = useState<PlannedMeal | null>(null);
  const [adding, setAdding] = useState(false);

  const days = weekDays(start);
  const weekMeals = mealsInRange(meals, days[0], days[6]);
  const recipeExists = (id: string) => recipes.some((r) => r.id === id);

  const addWeek = async () => {
    setAdding(true);
    try {
      await onAddToGroceries(weekMeals);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Meal plan"
      description="Plan the week, then shop for it in one tap."
      size="xl"
      fullOnMobile
      footer={
        <button
          type="button"
          disabled={weekMeals.length === 0 || adding}
          onClick={addWeek}
          className="min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-50 text-white text-base font-semibold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ShoppingBag className="w-4 h-4" aria-hidden="true" />}
          {weekMeals.length === 0 ? 'Add meals to shop for them' : `Add ${weekMeals.length} ${weekMeals.length === 1 ? 'meal' : 'meals'} to grocery list`}
        </button>
      }
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => setStart(addDays(start, -7))}
          className="min-h-11 min-w-11 rounded-full border border-stone-300 bg-surface flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-stone-900">{weekLabel(start)}</p>
          {start !== weekStart(today) && (
            <button type="button" onClick={() => setStart(weekStart(today))} className="text-sm font-semibold text-stone-700 hover:underline min-h-8">
              Back to this week
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => setStart(addDays(start, 7))}
          className="min-h-11 min-w-11 rounded-full border border-stone-300 bg-surface flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <ol className="flex flex-col gap-3">
        {days.map((day) => {
          const dayMeals = weekMeals.filter((m) => m.date === day);
          const isToday = day === today;
          return (
            <li key={day} className={`rounded-2xl border p-3 ${isToday ? 'border-amber-500/60 bg-amber-500/5' : 'border-stone-200 bg-surface'}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-stone-900">
                  {dayLabel(day, today)}
                  {(day === today || day === addDays(today, 1)) && (
                    <span className="ml-2 font-normal text-stone-600">
                      {fromDateKey(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setPicking({ date: day })}
                  className="min-h-11 px-3 rounded-xl text-sm font-semibold text-stone-800 hover:bg-stone-100 inline-flex items-center gap-1.5"
                  aria-label={`Add a meal on ${dayLabel(day, today)}`}
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add
                </button>
              </div>
              {dayMeals.length === 0 ? (
                <p className="text-sm text-stone-500 pb-1">Nothing planned</p>
              ) : (
                <ul className="flex flex-col divide-y divide-stone-200">
                  {dayMeals.map((meal) => (
                    <li key={meal.id} className="py-2 flex items-center gap-3">
                      <Thumb url={meal.heroImage} />
                      <button
                        type="button"
                        disabled={!recipeExists(meal.recipeId)}
                        onClick={() => onOpenRecipe(meal.recipeId)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block text-base font-semibold text-stone-900 truncate">{meal.recipeTitle}</span>
                        <span className="block text-sm text-stone-600">
                          For {meal.servings} {meal.servings === 1 ? 'person' : 'people'}
                          {!recipeExists(meal.recipeId) && ' · recipe deleted'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMoving(meal)}
                        aria-label={`Move ${meal.recipeTitle} to another day`}
                        title="Move to another day"
                        className="hit-area min-h-11 min-w-11 flex items-center justify-center rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                      >
                        <CalendarDays className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(meal)}
                        aria-label={`Remove ${meal.recipeTitle} from the plan`}
                        title="Remove from plan"
                        className="hit-area min-h-11 min-w-11 flex items-center justify-center rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={onViewGroceries} className="self-start min-h-11 text-sm font-semibold text-stone-800 hover:underline">
        See the grocery list by meal
      </button>

      {picking && !('recipe' in picking) && (
        <RecipePickerSheet
          recipes={recipes}
          dateLabel={dayLabel(picking.date, today)}
          onPick={(recipe) => setPicking({ recipe, date: picking.date })}
          onClose={() => setPicking(null)}
        />
      )}
      {picking && 'recipe' in picking && (
        <PlanDaySheet
          title={picking.recipe.title}
          confirmLabel="Add to plan"
          initialDate={picking.date}
          initialServings={picking.recipe.defaultServings}
          meals={meals}
          onConfirm={(date, servings) => {
            onPlan(picking.recipe, date, servings);
            setStart(weekStart(date));
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {moving && (
        <PlanDaySheet
          title="Move to another day"
          description={moving.recipeTitle}
          confirmLabel="Move"
          initialDate={moving.date}
          initialServings={moving.servings}
          meals={meals}
          ignoreMealId={moving.id}
          onConfirm={(date, servings) => {
            onMove(moving, date, servings);
            setStart(weekStart(date));
            setMoving(null);
          }}
          onClose={() => setMoving(null)}
        />
      )}
    </Sheet>
  );
};
