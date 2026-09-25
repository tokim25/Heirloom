import { scaleQuantity, formatFraction, convertUnit, fahrenheitToCelsius, celsiusToFahrenheit, formatStepTemperatures } from '../src/utils/units.ts';
import { getIngredientFacets, normalizeIngredientName, matchRecipeFilters, INITIAL_ORGANIZATION_FILTER, deriveProteinCategory } from '../src/utils/recipeTaxonomy.ts';
import { Recipe } from '../src/types/recipe.ts';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, message?: string) {
  if (condition) {
    results.push({ suite, name, passed: true });
  } else {
    results.push({ suite, name, passed: false, error: message || 'Assertion failed' });
  }
}

console.log('🧪 Starting Heirloom Quality & Regression Test Suite...\n');

// 1. Culinary Math & Fraction Scaling Suite
try {
  // Fraction formatting
  assert(formatFraction(0.5) === '½', 'Units & Scaling', '0.5 formats to ½');
  assert(formatFraction(0.25) === '¼', 'Units & Scaling', '0.25 formats to ¼');
  assert(formatFraction(0.75) === '¾', 'Units & Scaling', '0.75 formats to ¾');
  assert(formatFraction(1.5) === '1 ½', 'Units & Scaling', '1.5 formats to 1 ½');
  assert(formatFraction(2.333) === '2 ⅓', 'Units & Scaling', '2.333 formats to 2 ⅓');
  assert(formatFraction(0.125) === '⅛', 'Units & Scaling', '0.125 formats to ⅛');
  assert(formatFraction(0) === '0', 'Units & Scaling', '0 formats to 0');
  assert(formatFraction(null) === '', 'Units & Scaling', 'null formats to empty string');

  // Servings scaling
  assert(scaleQuantity(2, 4, 8) === 4, 'Units & Scaling', 'Scaling 2 units from 4 to 8 servings yields 4');
  assert(scaleQuantity(1, 2, 6) === 3, 'Units & Scaling', 'Scaling 1 unit from 2 to 6 servings yields 3');
  assert(scaleQuantity(null, 4, 8) === null, 'Units & Scaling', 'Scaling null quantity returns null');
  assert(scaleQuantity(2, 0, 4) === 2, 'Units & Scaling', 'Zero original servings safely returns amount');

  // Temperature Conversions
  assert(fahrenheitToCelsius(350) === 177, 'Temperature', '350°F converts to 177°C standard bake temp');
  assert(fahrenheitToCelsius(400) === 204, 'Temperature', '400°F converts to 204°C roast temp');
  assert(celsiusToFahrenheit(180) === 356, 'Temperature', '180°C converts to 356°F');
  assert(fahrenheitToCelsius(32) === 0, 'Temperature', '32°F converts to 0°C freezing point');

  // Text step temperature formatting
  const stepText = 'Bake at 375°F for 25 minutes.';
  const convertedStep = formatStepTemperatures(stepText, 'metric');
  assert(convertedStep.includes('191°C (375°F)'), 'Temperature in Steps', 'Embeds 191°C alongside 375°F for metric users');

  // Weight & Volume Conversions
  const flourCupToGrams = convertUnit(1, 'cup', 'flour', 'metric');
  assert(flourCupToGrams.unit === 'g' && Math.round(flourCupToGrams.amount || 0) === 125, 'Ingredient Density', '1 cup flour converts to ~125g');

  const butterTbspToGrams = convertUnit(2, 'tbsp', 'butter', 'metric');
  assert(butterTbspToGrams.unit === 'ml' && (butterTbspToGrams.amount || 0) === 30, 'Volume Conversion', '2 tbsp converts to 30ml');
} catch (e: any) {
  results.push({ suite: 'Units & Scaling', name: 'Exception in suite', passed: false, error: e.message });
}

// 2. Taxonomy & Ingredient Facet Indexing Suite
try {
  const mockRecipes: Recipe[] = [
    {
      id: 'r1',
      title: 'Garlic Butter Salmon',
      description: 'Quick pan salmon',
      source: { type: 'curated' },
      heroImage: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288',
      difficulty: 'Intermediate',
      cuisine: 'Mediterranean',
      defaultServings: 2,
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      totalTimeMinutes: 25,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ingredients: [
        { id: 'i1', name: 'Salmon fillets', amount: 2, unit: 'fillets', category: 'Meat & Seafood' },
        { id: 'i2', name: 'Garlic cloves, minced', amount: 3, unit: 'cloves', category: 'Produce' },
        { id: 'i3', name: 'Salted Butter', amount: 2, unit: 'tbsp', category: 'Dairy & Refrigerated' },
      ],
      steps: [{ stepNumber: 1, instruction: 'Sear salmon in butter with garlic.' }],
      tags: ['dinner', 'seafood'],
    },
    {
      id: 'r2',
      title: 'Garlic Butter Pasta',
      description: 'Comforting pasta dish',
      source: { type: 'curated' },
      heroImage: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141',
      difficulty: 'Easy',
      cuisine: 'Italian',
      defaultServings: 4,
      prepTimeMinutes: 5,
      cookTimeMinutes: 10,
      totalTimeMinutes: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ingredients: [
        { id: 'i4', name: 'Spaghetti pasta', amount: 8, unit: 'oz', category: 'Pantry & Spices' },
        { id: 'i5', name: 'Garlic cloves', amount: 4, unit: 'cloves', category: 'Produce' },
        { id: 'i6', name: 'Unsalted Butter', amount: 4, unit: 'tbsp', category: 'Dairy & Refrigerated' },
      ],
      steps: [{ stepNumber: 1, instruction: 'Boil pasta and toss with garlic butter.' }],
      tags: ['dinner', 'pasta'],
    },
  ];

  // Normalization
  assert(normalizeIngredientName('Garlic Cloves, Minced') === 'garlic', 'Taxonomy', 'Normalizes "Garlic Cloves, Minced" to "garlic"');
  assert(normalizeIngredientName('Fresh Rosemary (chopped)') === 'rosemary', 'Taxonomy', 'Normalizes "Fresh Rosemary (chopped)" to "rosemary"');

  const facets = getIngredientFacets(mockRecipes);
  assert(facets.length >= 3, 'Taxonomy', 'Extracts ingredient facets from recipe collection');

  const garlicFacet = facets.find(f => f.normalizedName.includes('garlic'));
  assert(Boolean(garlicFacet && garlicFacet.count === 2), 'Taxonomy', 'Garlic correctly identified across both recipes (frequency = 2)');

  // Protein categorizer
  assert(deriveProteinCategory(mockRecipes[0]) === 'seafood', 'Taxonomy', 'Categorizes salmon as seafood');
  assert(deriveProteinCategory(mockRecipes[1]) === 'pasta', 'Taxonomy', 'Categorizes pasta as pasta');

  // Filter with "all" mode
  const allFilter = { ...INITIAL_ORGANIZATION_FILTER, selectedIngredients: ['garlic', 'salmon'], ingredientFilterMode: 'all' as const };
  const allMatch = mockRecipes.filter(r => matchRecipeFilters(r, allFilter));
  assert(allMatch.length === 1 && allMatch[0].id === 'r1', 'Taxonomy', '"Must Have All" matches only recipe containing both garlic & salmon');

  // Filter with "any" mode
  const anyFilter = { ...INITIAL_ORGANIZATION_FILTER, selectedIngredients: ['salmon'], ingredientFilterMode: 'any' as const };
  const anyMatch = mockRecipes.filter(r => matchRecipeFilters(r, anyFilter));
  assert(anyMatch.length === 1 && anyMatch[0].id === 'r1', 'Taxonomy', '"Has Any" matches salmon recipe');

  const anyGarlicFilter = { ...INITIAL_ORGANIZATION_FILTER, selectedIngredients: ['garlic'], ingredientFilterMode: 'any' as const };
  const anyGarlic = mockRecipes.filter(r => matchRecipeFilters(r, anyGarlicFilter));
  assert(anyGarlic.length === 2, 'Taxonomy', '"Has Any" matches both recipes using garlic');
} catch (e: any) {
  results.push({ suite: 'Taxonomy', name: 'Exception in suite', passed: false, error: e.message });
}

// 3. Output Summary
const passedCount = results.filter(r => r.passed).length;
const failedCount = results.filter(r => !r.passed).length;

console.log(`Results: ${passedCount} passed, ${failedCount} failed out of ${results.length} assertions.\n`);

results.forEach(r => {
  const symbol = r.passed ? '✅' : '❌';
  console.log(`${symbol} [${r.suite}] ${r.name}`);
  if (r.error) {
    console.log(`   Error: ${r.error}`);
  }
});

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 All core algorithmic, math & data tests passed cleanly!');
}
