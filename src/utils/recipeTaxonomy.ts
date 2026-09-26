import { Recipe, Ingredient } from '../types/recipe.ts';

export type TimeBracket = 'all' | 'quick' | 'moderate' | 'slow';
export type PrepBracket = 'all' | 'express' | 'involved';
export type ProteinCategory = 'all' | 'seafood' | 'poultry' | 'meat' | 'pasta' | 'vegetarian';

export interface RecipeOrganizationFilter {
  searchQuery: string;
  cuisine: string;
  timeBracket: TimeBracket;
  prepBracket: PrepBracket;
  proteinCategory: ProteinCategory;
  selectedIngredients: string[];
  ingredientFilterMode: 'all' | 'any';
  sortBy: 'newest' | 'quickest' | 'alphabetical' | 'prepTime';
}

export const INITIAL_ORGANIZATION_FILTER: RecipeOrganizationFilter = {
  searchQuery: '',
  cuisine: 'All',
  timeBracket: 'all',
  prepBracket: 'all',
  proteinCategory: 'all',
  selectedIngredients: [],
  ingredientFilterMode: 'any',
  sortBy: 'newest',
};

export interface IngredientFacet {
  name: string;
  normalizedName: string;
  count: number;
  category: string;
  recipeIds: string[];
}

/**
 * Normalizes ingredient names to cluster variations (e.g., "Garlic Cloves" -> "Garlic")
 */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parentheticals like (skin-on)
    .replace(/[,;:.]/g, ' ') // strip punctuation like commas
    .replace(/\b(fresh|dried|organic|cloves|clove|stalks|fillets|cans|can|tbsp|tsp|cups|cup|heads|head|bunch|bunches|sliced|minced|chopped|finely|extra virgin|kosher|cracked|ground)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Fast inverted index: Extracts unique ingredients across all recipes
 */
export function getIngredientFacets(recipes: Recipe[]): IngredientFacet[] {
  const map = new Map<string, IngredientFacet>();

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const normalized = normalizeIngredientName(ing.name);
      if (!normalized || normalized.length < 2) continue;

      const existing = map.get(normalized);
      if (existing) {
        existing.count += 1;
        if (!existing.recipeIds.includes(recipe.id)) {
          existing.recipeIds.push(recipe.id);
        }
      } else {
        map.set(normalized, {
          name: ing.name.split('(')[0].trim(),
          normalizedName: normalized,
          count: 1,
          category: ing.category || 'Pantry',
          recipeIds: [recipe.id],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Information & Data Architecture: Categorize recipe by primary protein / hero ingredient
 */
export function deriveProteinCategory(recipe: Recipe): ProteinCategory {
  const text = (recipe.title + ' ' + (recipe.description || '') + ' ' + recipe.ingredients.map(i => i.name).join(' ')).toLowerCase();

  if (text.includes('salmon') || text.includes('fish') || text.includes('shrimp') || text.includes('tuna') || text.includes('cod') || text.includes('scallop') || text.includes('seafood')) {
    return 'seafood';
  }
  if (text.includes('chicken') || text.includes('turkey') || text.includes('duck') || text.includes('poultry')) {
    return 'poultry';
  }
  if (text.includes('beef') || text.includes('steak') || text.includes('pork') || text.includes('pancetta') || text.includes('lamb') || text.includes('bacon')) {
    return 'meat';
  }
  if (text.includes('pasta') || text.includes('spaghetti') || text.includes('fettuccine') || text.includes('gnocchi') || text.includes('noodle') || text.includes('risotto')) {
    return 'pasta';
  }
  return 'vegetarian';
}

/**
 * Filter recipes across all 4 core dimensions:
 * 1. Ingredients / Hero Protein
 * 2. Prep Time (Active hands-on time)
 * 3. Total / Cooking Time
 * 4. Cuisine & Regional Classification
 */
export function matchRecipeFilters(recipe: Recipe, filter: RecipeOrganizationFilter): boolean {
  // 1. Cuisine dimension
  if (filter.cuisine !== 'All') {
    const matchesCuisine =
      recipe.cuisine.toLowerCase() === filter.cuisine.toLowerCase() ||
      recipe.tags?.some((t) => t.toLowerCase() === filter.cuisine.toLowerCase());
    if (!matchesCuisine) return false;
  }

  // 2. Total Time dimension
  if (filter.timeBracket === 'quick' && recipe.totalTimeMinutes > 25) return false;
  if (filter.timeBracket === 'moderate' && (recipe.totalTimeMinutes <= 25 || recipe.totalTimeMinutes > 45)) return false;
  if (filter.timeBracket === 'slow' && recipe.totalTimeMinutes <= 45) return false;

  // 3. Prep Time dimension (Active hands-on preparation)
  if (filter.prepBracket === 'express' && recipe.prepTimeMinutes > 15) return false;
  if (filter.prepBracket === 'involved' && recipe.prepTimeMinutes <= 15) return false;

  // 4. Hero Protein / Ingredient category dimension
  if (filter.proteinCategory !== 'all') {
    const category = deriveProteinCategory(recipe);
    if (category !== filter.proteinCategory) return false;
  }

  // 5. Selected Ingredients dimension (Instant Inverted Querying)
  if (filter.selectedIngredients && filter.selectedIngredients.length > 0) {
    const recipeIngredientNames = recipe.ingredients.map((i) =>
      normalizeIngredientName(i.name)
    );

    if (filter.ingredientFilterMode === 'all') {
      const hasAll = filter.selectedIngredients.every((target) =>
        recipeIngredientNames.some((rName) => rName.includes(target) || target.includes(rName))
      );
      if (!hasAll) return false;
    } else {
      const hasAny = filter.selectedIngredients.some((target) =>
        recipeIngredientNames.some((rName) => rName.includes(target) || target.includes(rName))
      );
      if (!hasAny) return false;
    }
  }

  return true;
}

/**
 * Faceted metadata calculations for UI badges
 */
export function getTaxonomyFacets(recipes: Recipe[]) {
  const cuisines = Array.from(new Set(recipes.map((r) => r.cuisine).filter(Boolean)));
  
  const timeCounts = {
    all: recipes.length,
    quick: recipes.filter((r) => r.totalTimeMinutes <= 25).length,
    moderate: recipes.filter((r) => r.totalTimeMinutes > 25 && r.totalTimeMinutes <= 45).length,
    slow: recipes.filter((r) => r.totalTimeMinutes > 45).length,
  };

  const prepCounts = {
    all: recipes.length,
    express: recipes.filter((r) => r.prepTimeMinutes <= 15).length,
    involved: recipes.filter((r) => r.prepTimeMinutes > 15).length,
  };

  const proteinCounts = {
    all: recipes.length,
    seafood: recipes.filter((r) => deriveProteinCategory(r) === 'seafood').length,
    poultry: recipes.filter((r) => deriveProteinCategory(r) === 'poultry').length,
    meat: recipes.filter((r) => deriveProteinCategory(r) === 'meat').length,
    pasta: recipes.filter((r) => deriveProteinCategory(r) === 'pasta').length,
    vegetarian: recipes.filter((r) => deriveProteinCategory(r) === 'vegetarian').length,
  };

  return {
    cuisines,
    timeCounts,
    prepCounts,
    proteinCounts,
  };
}
