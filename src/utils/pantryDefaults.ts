import { PantryItem } from '../types/recipe.ts';

export const DEFAULT_PANTRY_ITEMS: PantryItem[] = [
  // Oils & Vinegars
  { id: 'pantry-1', name: 'Extra Virgin Olive Oil', category: 'Oils & Vinegars', inStock: true },
  { id: 'pantry-2', name: 'Neutral Cooking Oil (Canola/Avocado)', category: 'Oils & Vinegars', inStock: true },
  { id: 'pantry-3', name: 'Balsamic Vinegar', category: 'Oils & Vinegars', inStock: true },
  { id: 'pantry-4', name: 'Apple Cider Vinegar', category: 'Oils & Vinegars', inStock: true },
  { id: 'pantry-5', name: 'Toasted Sesame Oil', category: 'Oils & Vinegars', inStock: false },

  // Spices & Seasonings
  { id: 'pantry-6', name: 'Kosher Salt', category: 'Spices & Seasonings', inStock: true },
  { id: 'pantry-7', name: 'Freshly Ground Black Pepper', category: 'Spices & Seasonings', inStock: true },
  { id: 'pantry-8', name: 'Flaky Maldon Sea Salt', category: 'Spices & Seasonings', inStock: true },
  { id: 'pantry-9', name: 'Smoked Paprika', category: 'Spices & Seasonings', inStock: true },
  { id: 'pantry-10', name: 'Crushed Red Pepper Flakes', category: 'Spices & Seasonings', inStock: true },
  { id: 'pantry-11', name: 'Dried Oregano', category: 'Spices & Seasonings', inStock: true },
  { id: 'pantry-12', name: 'Garlic Powder', category: 'Spices & Seasonings', inStock: true },
  { id: 'pantry-13', name: 'Ground Cumin', category: 'Spices & Seasonings', inStock: false },

  // Baking & Grains
  { id: 'pantry-14', name: 'All-Purpose Flour', category: 'Baking & Grains', inStock: true },
  { id: 'pantry-15', name: 'Granulated Sugar', category: 'Baking & Grains', inStock: true },
  { id: 'pantry-16', name: 'Baking Powder', category: 'Baking & Grains', inStock: true },
  { id: 'pantry-17', name: 'Jasmine Rice', category: 'Baking & Grains', inStock: true },
  { id: 'pantry-18', name: 'Bronze-Cut Spaghetti or Rigatoni', category: 'Baking & Grains', inStock: true },

  // Aromatics & Produce
  { id: 'pantry-19', name: 'Garlic Cloves', category: 'Aromatics & Produce', inStock: true },
  { id: 'pantry-20', name: 'Yellow Onions', category: 'Aromatics & Produce', inStock: true },
  { id: 'pantry-21', name: 'Lemons', category: 'Aromatics & Produce', inStock: true },
  { id: 'pantry-22', name: 'Fresh Ginger', category: 'Aromatics & Produce', inStock: false },

  // Dairy & Eggs
  { id: 'pantry-23', name: 'Unsalted Butter', category: 'Dairy & Eggs', inStock: true },
  { id: 'pantry-24', name: 'Large Eggs', category: 'Dairy & Eggs', inStock: true },
  { id: 'pantry-25', name: 'Whole Milk or Heavy Cream', category: 'Dairy & Eggs', inStock: false },

  // Condiments & Sauces
  { id: 'pantry-26', name: 'Dijon Mustard', category: 'Condiments & Sauces', inStock: true },
  { id: 'pantry-27', name: 'Soy Sauce or Tamari', category: 'Condiments & Sauces', inStock: true },
  { id: 'pantry-28', name: 'Pure Maple Syrup or Raw Honey', category: 'Condiments & Sauces', inStock: true },
];

/**
 * Checks if a given recipe ingredient is already present and in-stock in the user's pantry.
 */
export function isIngredientInPantry(ingredientName: string, pantry: PantryItem[]): boolean {
  const cleanName = ingredientName.toLowerCase();
  return pantry.some((p) => {
    if (!p.inStock) return false;
    const pName = p.name.toLowerCase();
    return cleanName.includes(pName) || pName.includes(cleanName);
  });
}
