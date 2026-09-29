import { Recipe } from '../types/recipe.ts';

/** Starting the same recipe twice within this window counts as one use (reopening cooking mode, a misfire). */
export const COOKING_DEDUPE_MS = 30 * 60 * 1000;

export const useCountOf = (recipe: Pick<Recipe, 'useCount'>): number => Math.max(0, recipe.useCount ?? 0);

/** "Used once" / "Used 6 times", or null when it has never been used. */
export function useLabel(recipe: Pick<Recipe, 'useCount'>): string | null {
  const n = useCountOf(recipe);
  if (n === 0) return null;
  return n === 1 ? 'Used once' : `Used ${n} times`;
}

/** Most used first, ties broken by the more recent use, then by title. */
export const compareMostUsed = (a: Recipe, b: Recipe): number =>
  useCountOf(b) - useCountOf(a) || (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || a.title.localeCompare(b.title);

/** Most recently used first; recipes never used go last, newest-added first. */
export const compareRecentlyUsed = (a: Recipe, b: Recipe): number => {
  if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
  if (a.lastUsedAt) return -1;
  if (b.lastUsedAt) return 1;
  return b.createdAt.localeCompare(a.createdAt);
};

/** Whether a cooking start should count, given when the recipe was last used. */
export const shouldCountCooking = (recipe: Pick<Recipe, 'lastUsedAt'>, nowMs: number): boolean => {
  const last = recipe.lastUsedAt ? Date.parse(recipe.lastUsedAt) : NaN;
  return !Number.isFinite(last) || nowMs - last >= COOKING_DEDUPE_MS;
};
