import { scaleQuantity, formatFraction, convertUnit, fahrenheitToCelsius, celsiusToFahrenheit, formatStepTemperatures } from '../src/utils/units.ts';
import { getIngredientFacets, normalizeIngredientName, matchRecipeFilters, INITIAL_ORGANIZATION_FILTER, deriveProteinCategory } from '../src/utils/recipeTaxonomy.ts';
import { Recipe } from '../src/types/recipe.ts';
import { normalizeParsedRecipe, validateRecipeForSave, cleanRecipeForSave, RecipeParseError } from '../src/utils/recipeSchema.ts';
import { extractPageData, extractYouTubeDescription, isPrivateAddress, YOUTUBE_ID, urlRetrievedSuccessfully, sourceFromPastedUrl } from '../src/utils/pageExtract.ts';
import { generateWithFallback, isTransientGeminiError } from '../src/utils/geminiRetry.ts';
import { recipeIdFromPath, recipePath, shareIdFromPath, sharePath, joinCodeFromPath, joinPath } from '../src/utils/router.ts';
import { generateShareId, shareUrl, sanitizeRecipeForShare, recipeFromShare, SHARE_ID_LENGTH } from '../src/utils/shareLink.ts';
import { planGroceryMerge, normalizeItemName, normalizeUnit } from '../src/utils/groceryMerge.ts';
import { formatGroceryList, groupByAisle } from '../src/utils/groceryText.ts';
import { STORES, STORE_NAMES, resolveStore, storeNotice, instacartSearchUrl, visibleStoreNames } from '../src/utils/storeOptions.ts';
import { toDateKey, fromDateKey, addDays, weekStart, weekDays, isValidDateKey, dayLabel, planToList, mealsInRange, groupItemsByMeal, SHARED_GROUP, OTHER_GROUP } from '../src/utils/mealPlan.ts';
import { generateInviteCode, normalizeInviteCode, formatInviteCode, inviteLink } from '../src/utils/invite.ts';

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

// 3. Household invite codes
try {
  const code = generateInviteCode();
  assert(/^[A-HJ-NP-Z2-9]{8}$/.test(code), 'Invites', 'Generates 8-char codes without ambiguous characters');
  assert(formatInviteCode('ABCD2345') === 'HEIR-ABCD-2345', 'Invites', 'Formats code for display');
  assert(normalizeInviteCode('heir-abcd-2345') === 'ABCD2345', 'Invites', 'Normalizes formatted code');
  assert(normalizeInviteCode(' abcd 2345 ') === 'ABCD2345', 'Invites', 'Normalizes spaced bare code');
  assert(normalizeInviteCode('HEIRABCD') === 'HEIRABCD', 'Invites', 'Keeps a bare code that starts with HEIR');
  assert(normalizeInviteCode(formatInviteCode(code)) === code, 'Invites', 'Round-trips generated codes');
} catch (e: any) {
  results.push({ suite: 'Invites', name: 'Exception in suite', passed: false, error: e.message });
}

// 4. Recipe import: normalization never invents data
try {
  const messy = normalizeParsedRecipe({
    foundRecipe: true,
    title: '  Garlic Noodles ',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 0,
    defaultServings: 0,
    difficulty: 'easy',
    ingredients: [
      { name: 'Spaghetti', amount: 8, unit: 'oz', category: 'Pantry & Spices' },
      { name: 'Salt', amount: 0, unit: '', category: 'nonsense' },
      { name: '   ', amount: 1, unit: 'cup', category: 'Produce' },
    ],
    steps: [
      { instruction: 'Boil the pasta', timerSeconds: 600 },
      { instruction: '   ' },
      { instruction: 'Toss with garlic', timerSeconds: 0, temperature: '' },
    ],
  });
  assert(messy.title === 'Garlic Noodles', 'Import', 'Trims the title');
  assert(messy.ingredients.length === 2, 'Import', 'Drops ingredients with no name');
  assert(messy.ingredients[1].amount === null, 'Import', 'Missing quantity stays null, not guessed');
  assert(messy.ingredients[1].category === 'Other', 'Import', 'Unknown aisle falls back to Other');
  assert(messy.steps.length === 2 && messy.steps[1].stepNumber === 2, 'Import', 'Drops blank steps and renumbers');
  assert(messy.steps[0].timerSeconds === 600 && messy.steps[1].timerSeconds === undefined, 'Import', 'Keeps real timers only');
  assert(messy.totalTimeMinutes === 25, 'Import', 'Total time is at least prep + cook');
  assert(messy.difficulty === 'Easy', 'Import', 'Difficulty matched case-insensitively');
  assert(messy.defaultServings === 4, 'Import', 'Missing servings defaults to 4 for the user to review');

  let rejected = false;
  try {
    normalizeParsedRecipe({ foundRecipe: false, title: 'x', ingredients: [], steps: [] });
  } catch (e) {
    rejected = e instanceof RecipeParseError && e.code === 'no_recipe';
  }
  assert(rejected, 'Import', 'foundRecipe:false is rejected instead of saved');

  let emptyRejected = false;
  try {
    normalizeParsedRecipe({ foundRecipe: true, title: 'Nothing', ingredients: [], steps: [] });
  } catch {
    emptyRejected = true;
  }
  assert(emptyRejected, 'Import', 'A title with no ingredients or steps is rejected');

  const full = { ...messy, id: 'r', source: { type: 'manual' as const }, heroImage: ' ', createdAt: 'a', updatedAt: 'a' };
  assert(validateRecipeForSave(full) === null, 'Import', 'A normalized recipe validates');
  assert(validateRecipeForSave({ ...full, steps: [] }) !== null, 'Import', 'Validation requires steps');
  assert(cleanRecipeForSave({ ...full, steps: [full.steps[1], full.steps[0]] }).steps[0].stepNumber === 1, 'Import', 'Saving renumbers reordered steps');
} catch (e: any) {
  results.push({ suite: 'Import', name: 'Exception in suite', passed: false, error: e.message });
}

// 5. Page reading
try {
  const html = `<html><head>
    <meta property="og:image" content="/img/hero.jpg">
    <meta property="og:description" content="Best &amp; easiest noodles">
    <script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"Recipe","name":"Noodles","image":["https://cdn.example.com/n.jpg"]}]}</script>
  </head><body><p>Hello</p><script>var x=1</script></body></html>`;
  const page = extractPageData(html, 'https://example.com/noodles');
  assert(page.ldRecipe?.name === 'Noodles', 'Pages', 'Finds a Recipe inside a JSON-LD @graph');
  assert(page.image === 'https://cdn.example.com/n.jpg', 'Pages', 'Prefers the recipe image from JSON-LD');
  assert(page.description === 'Best & easiest noodles', 'Pages', 'Decodes meta description entities');
  assert(!page.text.includes('var x'), 'Pages', 'Strips scripts from page text');

  const og = extractPageData('<meta property="og:image" content="/img/hero.jpg">', 'https://example.com/a/b');
  assert(og.image === 'https://example.com/img/hero.jpg', 'Pages', 'Resolves relative og:image against the page');
  const bad = extractPageData('<meta property="og:image" content="javascript:alert(1)">', 'https://example.com/');
  assert(bad.image === '', 'Pages', 'Rejects non-http image URLs');

  assert(extractYouTubeDescription('..."shortDescription":"2 cups rice\\n1 tsp salt \\"fine\\""...') === '2 cups rice\n1 tsp salt "fine"', 'Pages', 'Reads a YouTube description');
  assert('https://youtu.be/dQw4w9WgXcQ'.match(YOUTUBE_ID)?.[1] === 'dQw4w9WgXcQ', 'Pages', 'Matches youtu.be links');
  assert('https://www.youtube.com/shorts/dQw4w9WgXcQ'.match(YOUTUBE_ID)?.[1] === 'dQw4w9WgXcQ', 'Pages', 'Matches Shorts links');

  assert(isPrivateAddress('169.254.169.254') && isPrivateAddress('10.0.0.5') && isPrivateAddress('127.0.0.1'), 'Security', 'Blocks metadata, private and loopback IPv4');
  assert(isPrivateAddress('::1') && isPrivateAddress('fd00::1'), 'Security', 'Blocks loopback and unique-local IPv6');
  assert(!isPrivateAddress('93.184.216.34'), 'Security', 'Allows public addresses');

  const fetched = (status: string) => ({ candidates: [{ urlContextMetadata: { urlMetadata: [{ urlRetrievalStatus: status }] } }] });
  assert(urlRetrievedSuccessfully(fetched('URL_RETRIEVAL_STATUS_SUCCESS')), 'Pages', 'Accepts a confirmed page retrieval');
  assert(!urlRetrievedSuccessfully(fetched('URL_RETRIEVAL_STATUS_ERROR')), 'Pages', 'Rejects a failed retrieval');
  const pastedLink = sourceFromPastedUrl(' https://www.maangchi.com/recipe/miyeokguk ');
  assert(pastedLink?.source.type === 'link' && pastedLink.source.sourceName === 'maangchi.com', 'Pages', 'Pasted text keeps its original page as the source');
  assert(sourceFromPastedUrl('https://youtu.be/dQw4w9WgXcQ')?.source.type === 'youtube', 'Pages', 'Pasted text from YouTube keeps the video source and thumbnail');
  assert(sourceFromPastedUrl('javascript:alert(1)') === null && sourceFromPastedUrl('') === null && sourceFromPastedUrl(42) === null, 'Pages', 'Ignores non-http source links');
  assert(!urlRetrievedSuccessfully({ candidates: [{}] }) && !urlRetrievedSuccessfully(null), 'Pages', 'Rejects answers with no retrieval proof (model memory)');
} catch (e: any) {
  results.push({ suite: 'Pages', name: 'Exception in suite', passed: false, error: e.message });
}

// 6. Gemini retry policy
try {
  const opts = { models: ['a', 'b', 'c'], attemptTimeoutMs: 1000, totalBudgetMs: 50000, retryPauseMs: 0, sleep: async () => {} };
  const overloaded = Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), { status: 503 });
  const missing = Object.assign(new Error('not found'), { status: 404 });

  assert(isTransientGeminiError(overloaded) && isTransientGeminiError({ name: 'AbortError' }), 'Gemini', '503 and timeouts are transient');
  assert(!isTransientGeminiError(missing), 'Gemini', '404 is not transient');

  const calls: string[] = [];
  const ok = await generateWithFallback(async (m) => { calls.push(m); if (m === 'c') return 'done'; throw overloaded; }, opts);
  assert(ok === 'done' && calls.join('') === 'abc', 'Gemini', 'Falls through models until one succeeds');

  let attempts = 0;
  const recovered = await generateWithFallback(async () => { attempts += 1; if (attempts <= 3) throw overloaded; return 'ok'; }, opts);
  assert(recovered === 'ok' && attempts === 4, 'Gemini', 'Retries a second pass after everything is briefly overloaded');

  let thrown: any = null;
  try {
    await generateWithFallback(async (m) => { throw m === 'c' ? missing : overloaded; }, opts);
  } catch (e) { thrown = e; }
  assert(isTransientGeminiError(thrown), 'Gemini', 'Reports the overload, not a later 404, so users are told to retry');

  let permanentCalls = 0;
  try { await generateWithFallback(async () => { permanentCalls += 1; throw missing; }, opts); } catch {}
  assert(permanentCalls === 3, 'Gemini', 'Does not do a second pass for permanent errors');

  let clock = 0;
  const budgetCalls: string[] = [];
  try {
    await generateWithFallback(async (m) => { budgetCalls.push(m); clock += 47000; throw overloaded; }, { ...opts, now: () => clock });
  } catch {}
  assert(budgetCalls.length === 1, 'Gemini', 'Stops trying once the time budget is spent');
} catch (e: any) {
  results.push({ suite: 'Gemini', name: 'Exception in suite', passed: false, error: e.message });
}

// 7. Recipe links
try {
  assert(recipePath('recipe-123') === '/r/recipe-123', 'Routes', 'Builds a recipe link');
  assert(recipeIdFromPath('/r/recipe-123') === 'recipe-123', 'Routes', 'Reads the recipe id from a link');
  assert(recipeIdFromPath(recipePath('a b/c?d')) === 'a b/c?d', 'Routes', 'Round-trips ids with special characters');
  assert(recipeIdFromPath('/') === null && recipeIdFromPath('/groceries') === null && recipeIdFromPath('/r/') === null, 'Routes', 'Other paths are not recipes');
  assert(recipeIdFromPath('/r/a/b') === null, 'Routes', 'Extra path segments are not a recipe link');
  assert(recipeIdFromPath('/r/%E0%A4%A') === null, 'Routes', 'A malformed link is ignored instead of crashing');
} catch (e: any) {
  results.push({ suite: 'Routes', name: 'Exception in suite', passed: false, error: e.message });
}

// 8. Grocery list quality
try {
  const item = (id: string, name: string, amount: number | null, unit: string, extra: Record<string, unknown> = {}) => ({
    id, listId: 'l', name, amount, unit, category: 'Produce' as const, assignedTo: 'Anyone', checked: false, addedBy: 'me', createdAt: '', ...extra,
  });
  assert(normalizeItemName('Eggs') === normalizeItemName('egg'), 'Groceries', 'Plurals match (eggs / egg)');
  assert(normalizeItemName('Tomatoes') === normalizeItemName('tomato'), 'Groceries', 'Plurals match (tomatoes / tomato)');
  assert(normalizeItemName('Ground beef (80/20)') === normalizeItemName('ground beef'), 'Groceries', 'Notes in brackets are ignored');
  assert(normalizeItemName('hummus') === 'hummus' && normalizeItemName('asparagus') === 'asparagus', 'Groceries', 'Words ending in ss/us are left alone');
  assert(normalizeUnit('Tablespoons') === 'tbsp' && normalizeUnit('lbs.') === 'lb' && normalizeUnit('Cups') === 'cup', 'Groceries', 'Unit aliases normalize');

  const existing = [item('a', 'ground beef', 1, 'lb', { recipeTitle: 'Burgers' }), item('b', 'salt', 0.5, 'tsp'), item('c', 'milk', 1, 'cup', { checked: true })];
  const plan = planGroceryMerge(existing, [
    { name: 'Ground Beef', amount: 2, unit: 'pounds', recipeTitle: 'Chili' },
    { name: 'salt', amount: 1, unit: 'cup' },
    { name: 'milk', amount: 1, unit: 'cup' },
    { name: 'onion', amount: 1, unit: '' },
  ]);
  assert(plan.toUpdate.length === 1 && plan.toUpdate[0].id === 'a' && plan.toUpdate[0].amount === 3, 'Groceries', '1 lb + 2 lb of beef combine into 3 lb');
  assert(plan.toUpdate[0].recipeTitle === 'Burgers, Chili', 'Groceries', 'Combined lines remember both recipes');
  assert(plan.toAdd.some((i) => i.name === 'salt') && plan.toAdd.some((i) => i.name === 'onion'), 'Groceries', 'Different units stay separate lines');
  assert(plan.toAdd.some((i) => i.name === 'milk'), 'Groceries', 'A checked (already bought) item is never merged into');
  assert(plan.combined === 1, 'Groceries', 'Counts how many ingredients were combined');

  const twice = planGroceryMerge([], [{ name: 'Salt', amount: 1, unit: 'tsp' }, { name: 'salt', amount: 0.5, unit: 'tsp' }, { name: 'pepper', amount: null, unit: '' }]);
  assert(twice.toAdd.length === 2 && twice.toAdd[0].amount === 1.5, 'Groceries', 'Repeats inside one recipe combine too');

  const noQty = planGroceryMerge([item('x', 'salt', null, '')], [{ name: 'salt', amount: null, unit: '' }]);
  assert(noQty.toAdd.length === 0 && noQty.toUpdate.length === 0, 'Groceries', 'To-taste items are not duplicated');
  const fillQty = planGroceryMerge([item('x', 'salt', null, '')], [{ name: 'salt', amount: 2, unit: '' }]);
  assert(fillQty.toUpdate[0]?.amount === 2, 'Groceries', 'A quantity fills in a blank one');

  const list = [item('1', 'Tomatoes', 2, 'lb'), item('2', 'Ground beef', 1, 'lb', { category: 'Meat & Seafood' }), item('3', 'Milk', 1, '', { category: 'Dairy & Refrigerated', checked: true })];
  const text = formatGroceryList('Groceries', 'Sprouts', list);
  assert(text.startsWith('Groceries (Sprouts)') && text.includes('Produce\n• 2 lb Tomatoes'), 'Groceries', 'Shared text is grouped by aisle');
  assert(text.indexOf('Produce') < text.indexOf('Meat & Seafood'), 'Groceries', 'Aisles follow store-walk order');
  assert(!text.includes('Milk'), 'Groceries', 'Checked items are left out of the shared list');
  assert(groupByAisle(list).length === 3, 'Groceries', 'Groups only aisles that have items');
  assert(formatGroceryList('Groceries', undefined, [item('9', 'x', 1, '', { checked: true })]).includes('Nothing left to buy'), 'Groceries', 'An empty list says so');
} catch (e: any) {
  results.push({ suite: 'Groceries', name: 'Exception in suite', passed: false, error: e.message });
}

// 9. Stores
try {
  assert(!STORE_NAMES.some((n) => /trader/i.test(n)), 'Stores', "Trader Joe's is not offered (it does not sell through Instacart)");
  assert(storeNotice("Trader Joe's")?.includes("doesn't sell through Instacart") === true, 'Stores', "A saved Trader Joe's gets a plain warning");
  assert(storeNotice('Sprouts Farmers Market') === null && storeNotice('Aldi') === null, 'Stores', 'Other stores get no warning');
  assert(resolveStore('Aldi').isCustom === true && resolveStore('Aldi').slug === '', 'Stores', 'An added store works without a built-in link');
  assert(instacartSearchUrl(resolveStore('Sprouts Farmers Market'), 'ground beef') === 'https://www.instacart.com/store/sprouts/s?k=ground%20beef', 'Stores', 'Item search links are store-specific');
  assert(instacartSearchUrl(resolveStore('Aldi'), 'ground beef') === 'https://www.instacart.com/store/s?k=ground%20beef', 'Stores', 'An added store falls back to a general Instacart search');
  assert(STORES.every((s) => s.slug), 'Stores', 'Every built-in store has a link slug');
  assert(visibleStoreNames().length === STORE_NAMES.length, 'Stores', 'With no preferences every built-in store is offered');
  assert(!visibleStoreNames([], ['Costco', 'H Mart']).includes('Costco'), 'Stores', 'Hidden stores leave the picker');
  assert(visibleStoreNames([], ['Costco'], 'Costco').includes('Costco'), 'Stores', 'The currently selected store is never hidden from its own picker');
  assert(visibleStoreNames(['Aldi'], []).includes('Aldi') && !visibleStoreNames(['Aldi'], ['Aldi']).includes('Aldi'), 'Stores', 'Added stores can be hidden too');
  assert(visibleStoreNames([], [], 'Publix')[0] === 'Publix', 'Stores', 'A saved store outside the list still shows'); 
} catch (e: any) {
  results.push({ suite: 'Stores', name: 'Exception in suite', passed: false, error: e.message });
}

// 10. Sharing recipes
try {
  const id = generateShareId();
  assert(id.length === SHARE_ID_LENGTH && /^[a-z2-9]+$/.test(id) && !/[ilo01]/.test(id), 'Sharing', 'Share ids are 20 characters without look-alikes');
  assert(new Set(Array.from({ length: 200 }, generateShareId)).size === 200, 'Sharing', 'Share ids do not repeat');
  assert(shareUrl('https://heirloom.tonykim.io/', 'abc') === 'https://heirloom.tonykim.io/s/abc', 'Sharing', 'Builds the share link');
  assert(shareIdFromPath(sharePath('abc123')) === 'abc123' && shareIdFromPath('/r/abc') === null && shareIdFromPath('/s/') === null && shareIdFromPath('/s/a/b') === null, 'Sharing', 'Only /s/:id is a share link');
  assert(joinCodeFromPath(joinPath('ABCD2345')) === 'ABCD2345' && joinCodeFromPath('/join') === null && joinCodeFromPath('/s/x') === null && joinCodeFromPath('/join/a/b') === null, 'Sharing', 'Only /join/:code is an invite link');
  assert(inviteLink('HEIR-ABCD-2345', 'https://heirloom.tonykim.io') === 'https://heirloom.tonykim.io/join/ABCD2345', 'Sharing', 'An invite link carries the bare code');
  assert(normalizeInviteCode(joinCodeFromPath(inviteLink('ABCD2345', 'https://x.test').replace('https://x.test', ''))!) === 'ABCD2345', 'Sharing', 'A code from an invite link joins');

  const recipe = { id: 'r1', userId: 'u1', householdId: 'h1', title: 'Burger', description: '', source: { type: 'link' as const, url: 'https://x.test', sourceName: 'x.test', youtubeId: undefined }, heroImage: '', prepTimeMinutes: 5, cookTimeMinutes: 15, totalTimeMinutes: 20, defaultServings: 4, cuisine: 'American', difficulty: 'Easy' as const, ingredients: [], steps: [], createdAt: 'a', updatedAt: 'b' };
  const snap = sanitizeRecipeForShare(recipe);
  assert(!('id' in snap) && !('userId' in snap) && !('householdId' in snap), 'Sharing', 'A share leaves out ids that point into your household');
  assert(snap.title === 'Burger' && !('youtubeId' in snap.source), 'Sharing', 'The recipe content is kept and undefined values are dropped');

  let tooBig = false;
  try { sanitizeRecipeForShare({ ...recipe, description: 'x'.repeat(800_000) }); } catch { tooBig = true; }
  assert(tooBig, 'Sharing', 'A recipe near the size limit is refused');

  const shared = { id: 'sh1', fromUid: 'u1', fromName: 'Alex', recipeId: 'r1', recipe: snap, createdAt: 'a', updatedAt: 'a' };
  const copy = recipeFromShare(shared, { newId: 'new1', householdId: 'h2', userId: 'u2', now: 'now' });
  assert(copy.id === 'new1' && copy.householdId === 'h2' && copy.userId === 'u2' && copy.createdAt === 'now', 'Sharing', 'A saved copy belongs to the recipient');
  assert(copy.source.sharedBy === 'Alex' && copy.source.sharedFromShareId === 'sh1' && copy.source.url === 'https://x.test', 'Sharing', 'A saved copy remembers who shared it and keeps the original source');
} catch (e: any) {
  results.push({ suite: 'Sharing', name: 'Exception in suite', passed: false, error: e.message });
}

// Meal planner
try {
  assert(toDateKey(fromDateKey('2026-09-30')) === '2026-09-30', 'Planner', 'Date keys round-trip in local time');
  assert(addDays('2026-09-30', 1) === '2026-10-01' && addDays('2026-01-01', -1) === '2025-12-31', 'Planner', 'Adding days crosses month and year ends');
  assert(weekStart('2026-09-28') === '2026-09-28' && weekStart('2026-10-04') === '2026-09-28' && weekStart('2026-10-05') === '2026-10-05', 'Planner', 'Weeks run Monday to Sunday');
  assert(weekDays('2026-09-28').length === 7 && weekDays('2026-09-28')[6] === '2026-10-04', 'Planner', 'A week has seven days');
  assert(isValidDateKey('2026-02-28') && !isValidDateKey('2026-02-30') && !isValidDateKey('tomorrow'), 'Planner', 'Bad dates are rejected');
  assert(dayLabel('2026-09-28', '2026-09-28') === 'Today' && dayLabel('2026-09-29', '2026-09-28') === 'Tomorrow', 'Planner', 'Today and tomorrow read naturally');

  const meal = (id: string, title: string, date: string) => ({ id, recipeId: 'r-' + title, recipeTitle: title, date, servings: 4, addedBy: 'Tony' });
  const plan = { a: meal('a', 'Tacos', '2026-09-30'), b: meal('b', 'Soup', '2026-09-29'), c: meal('c', 'Pasta', '2026-10-09') };
  assert(planToList(plan).map((m) => m.id).join('') === 'bac', 'Planner', 'The plan sorts by day');
  assert(mealsInRange(planToList(plan), '2026-09-28', '2026-10-04').length === 2, 'Planner', 'A week only includes its own days');

  const items = [
    { recipeTitle: 'Tacos' }, { recipeTitle: 'Soup' }, { recipeTitle: 'Tacos, Soup' },
    { recipeTitle: 'Burgers' }, { recipeTitle: undefined }, { recipeTitle: 'Pasta' },
  ];
  const groups = groupItemsByMeal(items, planToList(plan), '2026-09-28');
  assert(groups.map((g) => g.label).join('|') === `Soup|Tacos|Pasta|Burgers|${SHARED_GROUP}|${OTHER_GROUP}`, 'Planner', 'Grocery lines group by planned day, then unplanned recipes, shared, and other');
  assert(groups.reduce((n, g) => n + g.items.length, 0) === items.length, 'Planner', 'Grouping never drops a grocery line');
  const comma = groupItemsByMeal([{ recipeTitle: 'Salt, Fat, Acid' }], [meal('z', 'Salt, Fat, Acid', '2026-09-30')], '2026-09-28');
  assert(comma.length === 1 && comma[0].label === 'Salt, Fat, Acid', 'Planner', 'A recipe title with a comma stays one meal');
} catch (e: any) {
  results.push({ suite: 'Planner', name: 'Exception in suite', passed: false, error: e.message });
}

// 11. Output Summary
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
