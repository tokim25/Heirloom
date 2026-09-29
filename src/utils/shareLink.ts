import { Recipe, SharedRecipe } from '../types/recipe.ts';

// Lowercase letters and digits without look-alikes. 20 characters is about 100 bits, so a link cannot be guessed.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const SHARE_ID_LENGTH = 20;

export function generateShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_ID_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const shareUrl = (origin: string, id: string) => `${origin.replace(/\/$/, '')}/s/${encodeURIComponent(id)}`;

/** Roughly 1 MB is the most a database document can hold; refuse anything near that. */
export const MAX_SHARED_RECIPE_CHARS = 700_000;

/**
 * What goes into a share: the recipe without ids that point into your own household. Undefined values
 * are dropped so the snapshot serializes cleanly.
 */
export function sanitizeRecipeForShare(recipe: Recipe): SharedRecipe['recipe'] {
  // Your own use history stays with you.
  const { id: _id, userId: _userId, householdId: _householdId, useCount: _useCount, lastUsedAt: _lastUsedAt, ...rest } = recipe;
  const snapshot = JSON.parse(JSON.stringify(rest)) as SharedRecipe['recipe'];
  if (JSON.stringify(snapshot).length > MAX_SHARED_RECIPE_CHARS) {
    throw new Error('This recipe is too large to share.');
  }
  return snapshot;
}

/** A new recipe in the recipient's own cookbook, remembering who shared it. */
export function recipeFromShare(
  shared: SharedRecipe,
  options: { newId: string; householdId: string; userId: string; now: string }
): Recipe {
  return {
    ...shared.recipe,
    id: options.newId,
    userId: options.userId,
    householdId: options.householdId,
    source: { ...shared.recipe.source, sharedBy: shared.fromName, sharedFromShareId: shared.id },
    createdAt: options.now,
    updatedAt: options.now,
  };
}
