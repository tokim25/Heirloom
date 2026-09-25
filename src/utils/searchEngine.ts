import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';
import { Recipe, Ingredient, GroceryItem } from '../types/recipe.ts';

export type AisleCategory = GroceryItem['category'];

export const AISLE_CATEGORIES: AisleCategory[] = [
  'Produce',
  'Dairy & Refrigerated',
  'Meat & Seafood',
  'Pantry & Spices',
  'Bakery',
  'Frozen',
  'Other',
];

// Standard common kitchen staples mapped to supermarket aisles for predictive grocery input
export const COMMON_STAPLES: Array<{ name: string; category: AisleCategory; unit?: string }> = [
  { name: 'Extra Virgin Olive Oil', category: 'Pantry & Spices', unit: 'tbsp' },
  { name: 'Kosher Salt', category: 'Pantry & Spices', unit: 'tsp' },
  { name: 'Black Pepper', category: 'Pantry & Spices', unit: 'tsp' },
  { name: 'Garlic Cloves', category: 'Produce', unit: 'cloves' },
  { name: 'Yellow Onion', category: 'Produce', unit: 'whole' },
  { name: 'Fresh Cilantro', category: 'Produce', unit: 'bunch' },
  { name: 'Fresh Basil', category: 'Produce', unit: 'bunch' },
  { name: 'Fresh Rosemary', category: 'Produce', unit: 'sprigs' },
  { name: 'Lemons', category: 'Produce', unit: 'whole' },
  { name: 'Limes', category: 'Produce', unit: 'whole' },
  { name: 'Avocados', category: 'Produce', unit: 'whole' },
  { name: 'Cherry Tomatoes', category: 'Produce', unit: 'cups' },
  { name: 'Parmigiano-Reggiano', category: 'Dairy & Refrigerated', unit: 'cups' },
  { name: 'Burrata Cheese', category: 'Dairy & Refrigerated', unit: 'balls' },
  { name: 'Greek Yogurt', category: 'Dairy & Refrigerated', unit: 'cups' },
  { name: 'Unsalted Butter', category: 'Dairy & Refrigerated', unit: 'tbsp' },
  { name: 'Heavy Whipping Cream', category: 'Dairy & Refrigerated', unit: 'cups' },
  { name: 'Whole Milk', category: 'Dairy & Refrigerated', unit: 'cups' },
  { name: 'Eggs (Pasture-Raised)', category: 'Dairy & Refrigerated', unit: 'eggs' },
  { name: 'Wild Alaskan Salmon', category: 'Meat & Seafood', unit: 'fillets' },
  { name: 'Organic Chicken Breast', category: 'Meat & Seafood', unit: 'lbs' },
  { name: 'Pancetta / Guanciale', category: 'Meat & Seafood', unit: 'oz' },
  { name: 'Artisan Sourdough Loaf', category: 'Bakery', unit: 'loaf' },
  { name: 'Brioche Buns', category: 'Bakery', unit: 'pack' },
  { name: 'Bronze-Cut Spaghetti', category: 'Pantry & Spices', unit: 'oz' },
  { name: 'Jasmine Rice', category: 'Pantry & Spices', unit: 'cups' },
  { name: 'San Marzano Canned Tomatoes', category: 'Pantry & Spices', unit: 'can' },
  { name: 'Organic Chickpeas', category: 'Pantry & Spices', unit: 'can' },
  { name: 'Coconut Milk', category: 'Pantry & Spices', unit: 'can' },
  { name: 'Dijon Mustard', category: 'Pantry & Spices', unit: 'tbsp' },
  { name: 'Tamari / Soy Sauce', category: 'Pantry & Spices', unit: 'tbsp' },
  { name: 'Balsamic Vinegar of Modena', category: 'Pantry & Spices', unit: 'tbsp' },
  { name: 'Smoked Paprika', category: 'Pantry & Spices', unit: 'tsp' },
  { name: 'Ground Cumin', category: 'Pantry & Spices', unit: 'tsp' },
  { name: 'Frozen Peas', category: 'Frozen', unit: 'cups' },
  { name: 'Sparkling Mineral Water', category: 'Other', unit: 'bottles' },
];

/**
 * Configure Fuse.js instance for fuzzy searching recipes with typo tolerance
 */
export function createRecipeSearchIndex(recipes: Recipe[]): Fuse<Recipe> {
  const options: IFuseOptions<Recipe> = {
    keys: [
      { name: 'title', weight: 0.45 },
      { name: 'ingredients.name', weight: 0.3 },
      { name: 'cuisine', weight: 0.15 },
      { name: 'tags', weight: 0.1 },
      { name: 'description', weight: 0.1 },
    ],
    threshold: 0.35, // Allows tolerant typos: "salmn", "spageti", "burata", "parmisan"
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
  };

  return new Fuse(recipes, options);
}

export interface PredictiveSearchResult {
  matchingRecipes: Array<{
    recipe: Recipe;
    score?: number;
    matchReason?: string;
  }>;
  matchingIngredients: Array<{
    name: string;
    recipesCount: number;
    recipeTitles: string[];
  }>;
  matchingCuisines: string[];
}

/**
 * Predictive query analysis: returns matching recipes, ingredient terms, and cuisines
 */
export function getPredictiveRecipeSuggestions(
  query: string,
  recipes: Recipe[],
  fuseIndex?: Fuse<Recipe>
): PredictiveSearchResult {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 1) {
    return {
      matchingRecipes: [],
      matchingIngredients: [],
      matchingCuisines: [],
    };
  }

  const fuse = fuseIndex || createRecipeSearchIndex(recipes);
  const searchResults = fuse.search(trimmed);

  // Top matching recipes
  const matchingRecipes = searchResults.slice(0, 5).map((res) => {
    let matchReason = '';
    const matchedKey = res.matches?.[0]?.key;
    if (matchedKey === 'ingredients.name') {
      const matchVal = res.matches?.[0]?.value;
      matchReason = matchVal ? `Contains "${matchVal}"` : 'Ingredient match';
    } else if (matchedKey === 'cuisine') {
      matchReason = `${res.item.cuisine} Cuisine`;
    }

    return {
      recipe: res.item,
      score: res.score,
      matchReason,
    };
  });

  // Extract all distinct ingredients across the entire cookbook
  const ingredientMap = new Map<string, { name: string; recipeTitles: string[] }>();
  recipes.forEach((r) => {
    r.ingredients.forEach((ing) => {
      const cleanName = ing.name.trim();
      const lower = cleanName.toLowerCase();
      if (!ingredientMap.has(lower)) {
        ingredientMap.set(lower, { name: cleanName, recipeTitles: [r.title] });
      } else {
        const item = ingredientMap.get(lower)!;
        if (!item.recipeTitles.includes(r.title)) {
          item.recipeTitles.push(r.title);
        }
      }
    });
  });

  // Fuzzy match query against ingredients
  const ingredientList = Array.from(ingredientMap.values());
  const ingredientFuse = new Fuse(ingredientList, {
    keys: ['name'],
    threshold: 0.35,
    minMatchCharLength: 2,
  });

  const matchingIngredients = ingredientFuse
    .search(trimmed)
    .slice(0, 4)
    .map((res) => ({
      name: res.item.name,
      recipesCount: res.item.recipeTitles.length,
      recipeTitles: res.item.recipeTitles,
    }));

  // Match cuisines
  const allCuisines = Array.from(
    new Set(recipes.map((r) => r.cuisine).filter(Boolean))
  );
  const matchingCuisines = allCuisines.filter((c) =>
    c.toLowerCase().includes(trimmed.toLowerCase())
  );

  return {
    matchingRecipes,
    matchingIngredients,
    matchingCuisines,
  };
}

export interface PredictiveGroceryItem {
  name: string;
  category: AisleCategory;
  unit: string;
  source: 'staple' | 'recipe';
  recipeTitle?: string;
}

/**
 * Predictive auto-complete suggestions for grocery list item entry
 */
export function predictGroceryItem(
  query: string,
  recipes: Recipe[] = []
): PredictiveGroceryItem[] {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 1) return [];

  // Pool of candidate items: common staples + ingredients from user's recipes
  const candidateMap = new Map<string, PredictiveGroceryItem>();

  // Add staples
  COMMON_STAPLES.forEach((s) => {
    candidateMap.set(s.name.toLowerCase(), {
      name: s.name,
      category: s.category,
      unit: s.unit || '',
      source: 'staple',
    });
  });

  // Add ingredients from recipes
  recipes.forEach((r) => {
    r.ingredients.forEach((ing) => {
      const lower = ing.name.trim().toLowerCase();
      if (!candidateMap.has(lower)) {
        // Guess aisle category based on common rules or default to Produce/Pantry
        candidateMap.set(lower, {
          name: ing.name.trim(),
          category: guessAisleCategory(ing.name),
          unit: ing.unit || '',
          source: 'recipe',
          recipeTitle: r.title,
        });
      }
    });
  });

  const candidates = Array.from(candidateMap.values());

  const fuse = new Fuse(candidates, {
    keys: ['name'],
    threshold: 0.38,
    minMatchCharLength: 1,
  });

  return fuse.search(trimmed).slice(0, 5).map((r) => r.item);
}

/**
 * Helper to auto-categorize an ingredient into a supermarket aisle
 */
export function guessAisleCategory(ingredientName: string): AisleCategory {
  const name = ingredientName.toLowerCase();

  if (
    name.includes('onion') ||
    name.includes('garlic') ||
    name.includes('herb') ||
    name.includes('cilantro') ||
    name.includes('basil') ||
    name.includes('rosemary') ||
    name.includes('lemon') ||
    name.includes('lime') ||
    name.includes('tomato') ||
    name.includes('avocado') ||
    name.includes('lettuce') ||
    name.includes('spinach') ||
    name.includes('kale') ||
    name.includes('mushroom') ||
    name.includes('apple') ||
    name.includes('berry') ||
    name.includes('potato')
  ) {
    return 'Produce';
  }

  if (
    name.includes('beef') ||
    name.includes('chicken') ||
    name.includes('salmon') ||
    name.includes('fish') ||
    name.includes('pork') ||
    name.includes('shrimp') ||
    name.includes('pancetta') ||
    name.includes('bacon') ||
    name.includes('steak') ||
    name.includes('turkey') ||
    name.includes('tuna')
  ) {
    return 'Meat & Seafood';
  }

  if (
    name.includes('milk') ||
    name.includes('cheese') ||
    name.includes('parmigiano') ||
    name.includes('parmesan') ||
    name.includes('butter') ||
    name.includes('yogurt') ||
    name.includes('cream') ||
    name.includes('burrata') ||
    name.includes('egg') ||
    name.includes('ricotta') ||
    name.includes('mozzarella')
  ) {
    return 'Dairy & Refrigerated';
  }

  if (
    name.includes('bread') ||
    name.includes('sourdough') ||
    name.includes('baguette') ||
    name.includes('brioche') ||
    name.includes('tortilla') ||
    name.includes('bun')
  ) {
    return 'Bakery';
  }

  if (
    name.includes('pasta') ||
    name.includes('spaghetti') ||
    name.includes('rice') ||
    name.includes('flour') ||
    name.includes('sugar') ||
    name.includes('noodle') ||
    name.includes('quinoa') ||
    name.includes('couscous') ||
    name.includes('oil') ||
    name.includes('vinegar') ||
    name.includes('salt') ||
    name.includes('pepper') ||
    name.includes('paprika') ||
    name.includes('cumin') ||
    name.includes('oregano') ||
    name.includes('cinnamon') ||
    name.includes('spice') ||
    name.includes('canned') ||
    name.includes('can ') ||
    name.includes('beans') ||
    name.includes('chickpea') ||
    name.includes('broth') ||
    name.includes('stock') ||
    name.includes('sauce') ||
    name.includes('mustard') ||
    name.includes('mayo') ||
    name.includes('ketchup') ||
    name.includes('soy sauce') ||
    name.includes('tamari') ||
    name.includes('sriracha')
  ) {
    return 'Pantry & Spices';
  }

  if (name.includes('frozen') || name.includes('ice cream')) {
    return 'Frozen';
  }

  return 'Other';
}
