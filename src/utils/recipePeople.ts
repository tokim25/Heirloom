import { Recipe } from '../types/recipe.ts';

/** A recipe used this many times counts as a family favorite. */
export const FAVORITE_AT = 3;

export const isFavorite = (recipe: Pick<Recipe, 'useCount'>): boolean => (recipe.useCount ?? 0) >= FAVORITE_AT;

const possessive = (name: string): string => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** "from Halmoni's kitchen", or null when nobody is named. A shared recipe falls back to who sent it. */
export function signature(recipe: Pick<Recipe, 'fromName' | 'source'>): { text: string; kind: 'family' | 'sent' } | null {
  const from = recipe.fromName?.trim();
  if (from) return { text: `from ${possessive(from)} kitchen`, kind: 'family' };
  const sentBy = recipe.source?.sharedBy?.trim();
  if (sentBy) return { text: `sent by ${sentBy}`, kind: 'sent' };
  return null;
}
