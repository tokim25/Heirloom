import { PantryItem, PlannedMeal, Recipe, StockItem } from '../types/recipe.ts';
import { addDays, kindOf, slotOf } from './mealPlan.ts';
import { compareMostUsed } from './recipeUsage.ts';

// What Chef chat (beta answers) knows about the household's kitchen when it suggests dinner.
// Food data only: no emails, member names or who added what.

export const MAX_CONTEXT_RECIPES = 150;
export const MAX_CONTEXT_INGREDIENTS = 10;

export interface KitchenContext {
  cookbook: { id: string; title: string; totalTimeMinutes: number; ingredients: string[] }[];
  fridge: string[];
  freezer: string[];
  planned: { day: 'today' | 'tomorrow'; slot: string; kind: string; recipeId: string; title: string }[];
  pantry: string[];
}

export function buildKitchenContext(
  recipes: Recipe[],
  stockItems: StockItem[],
  plannedMeals: PlannedMeal[],
  pantryItems: PantryItem[],
  todayKey: string,
): KitchenContext {
  const tomorrowKey = addDays(todayKey, 1);
  return {
    cookbook: [...recipes]
      .sort(compareMostUsed)
      .slice(0, MAX_CONTEXT_RECIPES)
      .map((r) => ({
        id: r.id,
        title: r.title,
        totalTimeMinutes: r.totalTimeMinutes,
        ingredients: r.ingredients.slice(0, MAX_CONTEXT_INGREDIENTS).map((i) => i.name),
      })),
    fridge: stockItems.filter((s) => s.place === 'fridge').map((s) => s.name),
    freezer: stockItems.filter((s) => s.place === 'freezer').map((s) => s.name),
    planned: plannedMeals
      .filter((m) => m.date === todayKey || m.date === tomorrowKey)
      .map((m) => ({
        day: m.date === todayKey ? 'today' : 'tomorrow',
        slot: slotOf(m),
        kind: kindOf(m),
        recipeId: m.recipeId,
        title: m.recipeTitle,
      })),
    pantry: pantryItems.filter((p) => p.inStock).map((p) => p.name),
  };
}
