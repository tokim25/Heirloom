import { GroceryItem, PlannedMeal } from '../types/recipe.ts';

/** Local calendar day as YYYY-MM-DD (never UTC, so "today" is the day on the person's clock). */
export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const fromDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (key: string, days: number): string => {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

/** The Monday on or before the given day. */
export const weekStart = (key: string): string => {
  const day = fromDateKey(key).getDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
};

export const weekDays = (startKey: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(startKey, i));

export const isValidDateKey = (key: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(key) && toDateKey(fromDateKey(key)) === key;

/** "Today", "Tomorrow", or "Wed, Oct 1". */
export function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return 'Today';
  if (key === addDays(todayKey, 1)) return 'Tomorrow';
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Sep 29 – Oct 5" */
export function weekLabel(startKey: string): string {
  const fmt = (k: string) => fromDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(startKey)} – ${fmt(addDays(startKey, 6))}`;
}

export const planToList = (plan?: Record<string, PlannedMeal>): PlannedMeal[] =>
  Object.values(plan ?? {}).sort((a, b) => a.date.localeCompare(b.date) || a.recipeTitle.localeCompare(b.recipeTitle) || a.id.localeCompare(b.id));

export const mealsInRange = (meals: PlannedMeal[], fromKey: string, toKey: string) =>
  meals.filter((m) => m.date >= fromKey && m.date <= toKey);

export interface MealGroup<T> {
  key: string;
  label: string;
  /** Planned day for this meal, when there is one. */
  date?: string;
  items: T[];
}

export const SHARED_GROUP = 'Used in more than one meal';
export const OTHER_GROUP = 'Other items';

/**
 * Groups grocery lines by the meal they were added for, so the list can be read as "what do I need for Tuesday".
 * Meals planned for a day come first in date order, then recipes with no plan, then lines that serve several
 * meals (a merged "2 lb chicken"), then lines added by hand.
 */
export function groupItemsByMeal<T extends Pick<GroceryItem, 'recipeTitle'>>(
  items: T[],
  meals: PlannedMeal[],
  todayKey: string
): MealGroup<T>[] {
  const known = new Set(meals.map((m) => m.recipeTitle));
  // The next planned day for a title (or its latest past day when nothing is upcoming).
  const dateFor = (title: string): string | undefined => {
    const days = meals.filter((m) => m.recipeTitle === title).map((m) => m.date).sort();
    return days.find((d) => d >= todayKey) ?? days[days.length - 1];
  };

  const byTitle = new Map<string, T[]>();
  const shared: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    const raw = item.recipeTitle?.trim();
    if (!raw) {
      other.push(item);
    } else if (known.has(raw) || !raw.includes(', ')) {
      byTitle.set(raw, [...(byTitle.get(raw) ?? []), item]);
    } else {
      shared.push(item);
    }
  }

  const groups: MealGroup<T>[] = [...byTitle.entries()].map(([title, group]) => {
    const date = dateFor(title);
    return { key: title, label: title, date, items: group };
  });
  groups.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date) || a.label.localeCompare(b.label);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.label.localeCompare(b.label);
  });
  if (shared.length) groups.push({ key: SHARED_GROUP, label: SHARED_GROUP, items: shared });
  if (other.length) groups.push({ key: OTHER_GROUP, label: OTHER_GROUP, items: other });
  return groups;
}
