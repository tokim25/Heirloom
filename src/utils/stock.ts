import { PlannedMeal, StockItem } from '../types/recipe.ts';
import { addDays } from './mealPlan.ts';

export const stockToList = (stock?: Record<string, StockItem>): StockItem[] =>
  Object.values(stock ?? {}).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

/** Freezer items to take out today: the ones linked to a meal planned for tomorrow. */
export function thawTonight(items: StockItem[], meals: PlannedMeal[], todayKey: string): StockItem[] {
  const tomorrow = addDays(todayKey, 1);
  const tomorrowIds = new Set(meals.filter((m) => m.date === tomorrow).map((m) => m.id));
  return items.filter((i) => i.place === 'freezer' && i.mealId && tomorrowIds.has(i.mealId));
}
