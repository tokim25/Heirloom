import { scaleQuantity, formatFraction, convertUnit, fahrenheitToCelsius, celsiusToFahrenheit, formatStepTemperatures } from '../src/utils/units.ts';
import { getIngredientFacets, normalizeIngredientName, matchRecipeFilters, INITIAL_ORGANIZATION_FILTER, deriveProteinCategory } from '../src/utils/recipeTaxonomy.ts';
import { Recipe } from '../src/types/recipe.ts';
import { normalizeParsedRecipe, validateRecipeForSave, cleanRecipeForSave, RecipeParseError } from '../src/utils/recipeSchema.ts';
import { extractPageData, extractYouTubeDescription, isPrivateAddress, YOUTUBE_ID, urlRetrievedSuccessfully, sourceFromPastedUrl, socialVideoSite } from '../src/utils/pageExtract.ts';
import { generateWithFallback, isTransientGeminiError, youtubeFailurePlan } from '../src/utils/geminiRetry.ts';
import { recipeIdFromPath, recipePath, shareIdFromPath, sharePath, joinCodeFromPath, joinPath } from '../src/utils/router.ts';
import { normalizeEmail, timeAgo } from '../src/utils/inbox.ts';
import { generateShareId, shareUrl, sanitizeRecipeForShare, recipeFromShare, SHARE_ID_LENGTH } from '../src/utils/shareLink.ts';
import { planGroceryMerge, normalizeItemName, normalizeUnit } from '../src/utils/groceryMerge.ts';
import { formatGroceryList, groupByAisle } from '../src/utils/groceryText.ts';
import { STORES, STORE_NAMES, resolveStore, storeNotice, instacartSearchUrl, visibleStoreNames } from '../src/utils/storeOptions.ts';
import { toDateKey, fromDateKey, addDays, weekStart, weekDays, isValidDateKey, dayLabel, planToList, slotOf, kindOf, mealsInRange, groupItemsByMeal, SHARED_GROUP, OTHER_GROUP } from '../src/utils/mealPlan.ts';
import { ingredientsForStep } from '../src/utils/stepIngredients.ts';
import { thawTonight, stockToList } from '../src/utils/stock.ts';
import { useLabel, compareMostUsed, compareRecentlyUsed, shouldCountCooking, COOKING_DEDUPE_MS } from '../src/utils/recipeUsage.ts';
import { createRecipeSearchIndex, searchRecipes } from '../src/utils/searchEngine.ts';
import { dinnerMessage, inboxMessage, dateKeyInZone, wantsPush } from '../src/utils/pushMessages.ts';
import { signature, isFavorite, FAVORITE_AT } from '../src/utils/recipePeople.ts';
import { greeting, timeOfDay, tonightsDinner } from '../src/utils/greeting.ts';
import { parallaxOffset, heroShift } from '../src/utils/parallax.ts';
import { generateInviteCode, normalizeInviteCode, formatInviteCode, inviteLink } from '../src/utils/invite.ts';
import { parseChatEmbeds } from '../src/utils/chatEmbeds.ts';
import { CHEF_EXAMPLE, CHEF_TONIGHT_EXAMPLE, checkChefAnswer, unwrapChefAnswer } from '../src/utils/chefLibrary.ts';
import { firstTextChunk, writeTextStream, readTextStream } from '../src/utils/chefStream.ts';
import { buildKitchenContext, MAX_CONTEXT_RECIPES, MAX_CONTEXT_INGREDIENTS } from '../src/utils/kitchenContext.ts';
import { PlannedMeal, StockItem, PantryItem } from '../src/types/recipe.ts';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ChefAnswer } from '../src/components/chef/ChefAnswer.tsx';

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

  const slotted = { d: { ...meal('d', 'Eggs', '2026-09-30'), slot: 'breakfast' as const }, e: meal('e', 'Chicken', '2026-09-30'), f: { ...meal('f', 'Salad', '2026-09-30'), slot: 'lunch' as const, kind: 'flexible' as const } };
  assert(planToList(slotted).map((m) => m.id).join('') === 'dfe', 'Planner', 'A day sorts breakfast, lunch, then dinner');
  assert(slotOf({ slot: undefined }) === 'dinner' && kindOf({ kind: undefined }) === 'cook', 'Planner', 'Older meals with no slot or type read as dinner and cook');

  const stock = (id: string, name: string, place: 'fridge' | 'freezer', mealId?: string) => ({ id, name, place, mealId, addedBy: 'Tony' });
  const stockMeals = [meal('m1', 'Fajitas', '2026-09-29'), meal('m2', 'Soup', '2026-09-30')];
  const stockItems = [stock('s1', 'Chicken', 'freezer', 'm1'), stock('s2', 'Stock', 'freezer', 'm2'), stock('s3', 'Cream', 'fridge', 'm1'), stock('s4', 'Shrimp', 'freezer')];
  assert(thawTonight(stockItems, stockMeals, '2026-09-28').map((i) => i.id).join() === 's1', 'Fridge & Freezer', 'Thaw tonight lists freezer items linked to tomorrow only');
  assert(thawTonight(stockItems, stockMeals, '2026-09-27').length === 0, 'Fridge & Freezer', 'Nothing to thaw when no linked meal is tomorrow');
  assert(thawTonight([stock('s5', 'Beef', 'freezer', 'gone')], stockMeals, '2026-09-28').length === 0, 'Fridge & Freezer', 'A link to a deleted meal does not break the hint');
  assert(stockToList({ a: stock('a', 'Shrimp', 'freezer'), b: stock('b', 'Chicken', 'freezer') }).map((i) => i.name).join() === 'Chicken,Shrimp', 'Fridge & Freezer', 'The list sorts by name');

  const items = [
    { recipeTitle: 'Tacos' }, { recipeTitle: 'Soup' }, { recipeTitle: 'Tacos, Soup' },
    { recipeTitle: 'Burgers' }, { recipeTitle: undefined }, { recipeTitle: 'Pasta' },
  ];
  const groups = groupItemsByMeal(items, planToList(plan), '2026-09-28');
  assert(groups.map((g) => g.label).join('|') === `Soup|Tacos|Pasta|Burgers|${SHARED_GROUP}|${OTHER_GROUP}`, 'Planner', 'Grocery lines group by planned day, then unplanned recipes, shared, and other');
  assert(groups.reduce((n, g) => n + g.items.length, 0) === items.length, 'Planner', 'Grouping never drops a grocery line');
  const comma = groupItemsByMeal([{ recipeTitle: 'Salt, Fat, Acid' }], [meal('z', 'Salt, Fat, Acid', '2026-09-30')], '2026-09-28');
  assert(comma.length === 1 && comma[0].label === 'Salt, Fat, Acid', 'Planner', 'A recipe title with a comma stays one meal');

  const ing = (id: string, name: string) => ({ id, name, amount: 1, unit: 'cup', category: 'Other' as const });
  const pantry = [ing('1', 'olive oil'), ing('2', 'yellow onion'), ing('3', 'tomatoes'), ing('4', 'chicken broth'), ing('5', 'salt')];
  const names = (instruction: string, stepIngredients?: string[]) => ingredientsForStep(pantry, { instruction, stepIngredients }).map((i) => i.name).join('|');
  assert(names('Heat the oil, then add the onions.') === 'olive oil|yellow onion', 'Step Ingredients', 'A step finds ingredients by the last word of their name, ignoring plurals');
  assert(names('Pour in the chicken broth.') === 'chicken broth', 'Step Ingredients', 'A full ingredient name matches');
  assert(names('Stir well and simmer.') === '', 'Step Ingredients', 'A step that names nothing shows nothing');
  assert(names('Stir well.', ['salt']) === 'salt', 'Step Ingredients', 'Tagged ingredients still show when the text does not name them');
  assert(names('Chop the tomato and the onion. Season.', ['tomatoes']) === 'yellow onion|tomatoes', 'Step Ingredients', 'Tags and text combine without repeats, in recipe order');
} catch (e: any) {
  results.push({ suite: 'Planner', name: 'Exception in suite', passed: false, error: e.message });
}

// Push messages
try {
  const meal = (id: string, title: string, date: string, extra: Record<string, unknown> = {}) => ({ id, recipeId: id, recipeTitle: title, date, servings: 4, addedBy: 'T', ...extra } as any);
  const frozen = (id: string, name: string, mealId?: string) => ({ id, name, place: 'freezer', mealId, addedBy: 'T' } as any);
  assert(dateKeyInZone(new Date('2026-10-18T03:00:00Z'), 'America/Los_Angeles') === '2026-10-17' && dateKeyInZone(new Date('2026-10-18T03:00:00Z'), 'Asia/Tokyo') === '2026-10-18', 'Push', 'Today is the day in the person\'s own time zone');
  assert(dateKeyInZone(new Date('2026-10-18T03:00:00Z'), 'Not/AZone') === '2026-10-18', 'Push', 'A bad time zone falls back to UTC instead of failing');
  const m = inboxMessage('Alex', 'Pigs in a Blanket');
  assert(m.title === 'Alex sent you a recipe' && m.body === 'Pigs in a Blanket' && m.url === '/inbox', 'Push', 'The inbox notification names the sender and recipe');
  assert(dinnerMessage([], [], '2026-10-18') === null, 'Push', 'Nothing planned means no notification');
  const one = dinnerMessage([meal('a', 'Thai Basil Chicken', '2026-10-18')], [], '2026-10-18')!;
  assert(one.title === 'Tonight: Thai Basil Chicken' && one.body === 'For 4 people.' && one.url === '/plan', 'Push', 'Tonight\'s dinner reads naturally');
  const lunchOnly = dinnerMessage([meal('a', 'Salad', '2026-10-18', { slot: 'lunch' })], [], '2026-10-18');
  assert(lunchOnly === null, 'Push', 'Lunch and breakfast do not trigger the dinner reminder');
  const two = dinnerMessage([meal('a', 'Tacos', '2026-10-18'), meal('b', 'Soup', '2026-10-18')], [], '2026-10-18')!;
  assert(two.title === 'Tonight: Tacos and Soup', 'Push', 'Two dinners are joined');
  const left = dinnerMessage([meal('a', 'Chili', '2026-10-18', { kind: 'leftovers' })], [], '2026-10-18')!;
  assert(left.title === 'Leftovers tonight: Chili', 'Push', 'Leftovers are called leftovers');
  const thaw = dinnerMessage([meal('a', 'Tacos', '2026-10-18'), meal('b', 'Pasta', '2026-10-19')], [frozen('s1', 'ground beef', 'b'), frozen('s2', 'peas')], '2026-10-18')!;
  assert(thaw.body === "For 4 people. Take ground beef out of the freezer tonight for tomorrow's Pasta.", 'Push', 'The thaw reminder names the item and tomorrow\'s meal');
  const thawOnly = dinnerMessage([meal('b', 'Pasta', '2026-10-19')], [frozen('s1', 'ground beef', 'b')], '2026-10-18')!;
  assert(thawOnly.title === 'Nothing to cook tonight' && thawOnly.body.startsWith('Take ground beef'), 'Push', 'A thaw reminder can go out on its own');
  assert(wantsPush(undefined, 'inbox') && wantsPush({ dinner: true }, 'dinner') && !wantsPush({ inbox: false }, 'inbox') && wantsPush({ inbox: false }, 'dinner'), 'Push', 'Both kinds are on until switched off, independently');
} catch (e: any) {
  results.push({ suite: 'Push', name: 'Exception in suite', passed: false, error: e.message });
}

// Parallax
try {
  assert(Math.abs(parallaxOffset(300, 200, 800, 10)) < 0.01, 'Parallax', 'A frame at the middle of the screen is not shifted');
  assert(parallaxOffset(800, 200, 800, 10) < -9 && parallaxOffset(-200, 200, 800, 10) > 9, 'Parallax', 'The picture drifts opposite to the scroll, entering and leaving');
  assert(parallaxOffset(5000, 200, 800, 10) === -10 && parallaxOffset(-5000, 200, 800, 10) === 10, 'Parallax', 'The shift never exceeds its range');
  assert(heroShift(0, 300) === 0 && Math.abs(heroShift(100, 300) - 35) < 1e-9 && Math.abs(heroShift(900, 300) - 105) < 1e-9 && heroShift(-40, 300) === 0, 'Parallax', 'The hero sinks at a third of the scroll and stops at its own height');
} catch (e: any) {
  results.push({ suite: 'Parallax', name: 'Exception in suite', passed: false, error: e.message });
}

// Greeting
try {
  assert(timeOfDay(5) === 'morning' && timeOfDay(11) === 'morning' && timeOfDay(12) === 'afternoon' && timeOfDay(17) === 'evening' && timeOfDay(22) === 'night' && timeOfDay(3) === 'night', 'Greeting', 'Hours map to the part of the day');
  assert(greeting(19, 'Tony Kim') === 'Good evening, Tony' && greeting(8) === 'Good morning' && greeting(1, '  ') === 'Still up', 'Greeting', 'Uses the first name, and copes with none');
  const m = (id: string, date: string, extra: Record<string, unknown> = {}) => ({ id, recipeId: 'r' + id, recipeTitle: 'T' + id, date, servings: 4, addedBy: 'x', ...extra } as any);
  assert(tonightsDinner([m('a', '2026-10-23')], '2026-10-23', 9) === null, 'Greeting', 'Nothing is suggested before midday');
  assert(tonightsDinner([m('a', '2026-10-23')], '2026-10-23', 15)?.id === 'a', 'Greeting', 'Tonight\'s dinner shows from midday');
  assert(tonightsDinner([m('a', '2026-10-23', { kind: 'leftovers' })], '2026-10-23', 18) === null && tonightsDinner([m('a', '2026-10-23', { slot: 'lunch' })], '2026-10-23', 18) === null && tonightsDinner([m('a', '2026-10-24')], '2026-10-23', 18) === null, 'Greeting', 'Leftovers, lunches and other days are skipped');
} catch (e: any) {
  results.push({ suite: 'Greeting', name: 'Exception in suite', passed: false, error: e.message });
}

// Recipe people
try {
  const base = { source: { type: 'link' as const } } as any;
  assert(signature({ ...base, fromName: 'Halmoni' })?.text === "from Halmoni's kitchen", 'People', 'A family name becomes a signature');
  assert(signature({ ...base, fromName: 'James' })?.text === "from James' kitchen", 'People', 'Names ending in s get a plain apostrophe');
  assert(signature({ ...base, fromName: '  ' }) === null && signature(base) === null, 'People', 'Blank means no signature');
  const sent = signature({ source: { type: 'link', sharedBy: 'Jess' } } as any);
  assert(sent?.kind === 'sent' && sent.text === 'sent by Jess', 'People', 'A shared recipe says who sent it');
  assert(signature({ fromName: 'Dad', source: { type: 'link', sharedBy: 'Jess' } } as any)?.kind === 'family', 'People', 'The family name wins over the sender');
  assert(!isFavorite({}) && !isFavorite({ useCount: FAVORITE_AT - 1 }) && isFavorite({ useCount: FAVORITE_AT }), 'People', 'Three uses make a family favorite');
} catch (e: any) {
  results.push({ suite: 'People', name: 'Exception in suite', passed: false, error: e.message });
}

// YouTube failure handling
try {
  assert(youtubeFailurePlan({ status: 500 }, true) === 'use_description' && youtubeFailurePlan({ status: 503 }, true) === 'use_description', 'YouTube', 'A description is used whenever the video fails');
  assert(youtubeFailurePlan({ status: 500 }, false) === 'video_unreadable', 'YouTube', 'A 500 on a video with no description points to the paste path, not "busy"');
  assert(youtubeFailurePlan({ status: 503 }, false) === 'busy' && youtubeFailurePlan({ status: 429 }, false) === 'busy', 'YouTube', 'Real overload still says busy');
  assert(youtubeFailurePlan({ status: 400 }, false) === 'video_unreadable', 'YouTube', 'A rejected video points to the paste path');
} catch (e: any) {
  results.push({ suite: 'YouTube', name: 'Exception in suite', passed: false, error: e.message });
}

// Recipe usage and search
try {
  const r = (id: string, title: string, extra: Partial<Recipe> = {}, ings: string[] = []) => ({ id, title, description: '', cuisine: 'Other', tags: [], createdAt: '2026-01-0' + id, ingredients: ings.map((name, i) => ({ id: 'i' + i, name, amount: 1, unit: '', category: 'Other' })), ...extra } as unknown as Recipe);
  const a = r('1', 'Tacos', { useCount: 3, lastUsedAt: '2026-09-01T00:00:00Z' });
  const b = r('2', 'Soup', { useCount: 5, lastUsedAt: '2026-08-01T00:00:00Z' });
  const c = r('3', 'Pasta');
  const d = r('4', 'Ramen', { useCount: 3, lastUsedAt: '2026-09-20T00:00:00Z' });
  assert([a, b, c, d].sort(compareMostUsed).map((x) => x.title).join() === 'Soup,Ramen,Tacos,Pasta', 'Usage', 'Most used first, ties go to the more recent use, unused last');
  assert([a, b, c, d].sort(compareRecentlyUsed).map((x) => x.title).join() === 'Ramen,Tacos,Soup,Pasta', 'Usage', 'Recently used first, never used last');
  assert(useLabel(c) === null && useLabel(r('5', 'X', { useCount: 1 })) === 'Used once' && useLabel(b) === 'Used 5 times' && useLabel(r('6', 'Y', { useCount: -2 })) === null, 'Usage', 'The label reads naturally and ignores bad counts');
  const now = Date.parse('2026-09-29T12:00:00Z');
  assert(shouldCountCooking({}, now) && !shouldCountCooking({ lastUsedAt: new Date(now - 60_000).toISOString() }, now) && shouldCountCooking({ lastUsedAt: new Date(now - COOKING_DEDUPE_MS - 1000).toISOString() }, now), 'Usage', 'Reopening cooking mode within 30 minutes does not count twice');

  const book = [
    r('7', 'Spaghetti Carbonara', {}, ['eggs', 'pecorino']),
    r('8', 'Chicken Tacos', {}, ['chicken thighs', 'lime', 'tortillas']),
    r('9', 'Lime Pie', {}, ['lime', 'condensed milk']),
  ];
  const index = createRecipeSearchIndex(book);
  assert(searchRecipes(index, 'spageti')[0]?.title === 'Spaghetti Carbonara', 'Search', 'A typo still finds the recipe');
  assert(searchRecipes(index, 'chiken lime').map((x) => x.title).join() === 'Chicken Tacos', 'Search', 'Every word has to match, typos allowed');
  assert(searchRecipes(index, '   ').length === 0 && searchRecipes(index, 'zzzzqq').length === 0, 'Search', 'Nothing matches blanks or nonsense');
} catch (e: any) {
  results.push({ suite: 'Usage', name: 'Exception in suite', passed: false, error: e.message });
}

// Social video links
try {
  assert(socialVideoSite('https://www.instagram.com/reel/C8abc123/') === 'Instagram' && socialVideoSite('https://instagr.am/p/x') === 'Instagram', 'Social', 'Instagram links are recognised');
  assert(socialVideoSite('https://vm.tiktok.com/ZM123/') === 'TikTok' && socialVideoSite('https://www.tiktok.com/@a/video/1') === 'TikTok', 'Social', 'TikTok links are recognised');
  assert(socialVideoSite('https://fb.watch/abc') === 'Facebook', 'Social', 'Facebook video links are recognised');
  assert(socialVideoSite('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === null && socialVideoSite('https://cooking.nytimes.com/x') === null && socialVideoSite('https://notinstagram.com/x') === null && socialVideoSite('nonsense') === null, 'Social', 'Other sites are left alone');
} catch (e: any) {
  results.push({ suite: 'Social', name: 'Exception in suite', passed: false, error: e.message });
}


// 11. Inbox helpers
try {
  assert(normalizeEmail('  Alex@Example.COM ') === 'alex@example.com', 'Inbox', 'Emails are trimmed and lowercased');
  assert(normalizeEmail('not an email') === null && normalizeEmail('a@b') === null && normalizeEmail('') === null && normalizeEmail('a b@c.com') === null, 'Inbox', 'Things that are not emails are rejected');
  const now = Date.parse('2026-09-29T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  assert(timeAgo(ago(20_000), now) === 'just now', 'Inbox', 'Under a minute reads "just now"');
  assert(timeAgo(ago(60_000), now) === '1 minute ago' && timeAgo(ago(5 * 60_000), now) === '5 minutes ago', 'Inbox', 'Minutes are singular and plural');
  assert(timeAgo(ago(3 * 3_600_000), now) === '3 hours ago', 'Inbox', 'Hours');
  assert(timeAgo(ago(30 * 3_600_000), now) === 'yesterday' && timeAgo(ago(4 * 86_400_000), now) === '4 days ago', 'Inbox', 'Yesterday and days');
  assert(/\d/.test(timeAgo(ago(20 * 86_400_000), now)), 'Inbox', 'Older than a week shows a date');
  assert(timeAgo('garbage', now) === '' && timeAgo(ago(-5000), now) === 'just now', 'Inbox', 'Bad or future times do not break');
} catch (e: any) {
  results.push({ suite: 'Inbox', name: 'Exception in suite', passed: false, error: e.message });
}


// 12. Chef chat embeds
try {
  const fence = (label: string, body: unknown) => '```' + label + '\n' + JSON.stringify(body) + '\n```';
  const r = (title: string) => ({ title, prepTimeMinutes: 10, cookTimeMinutes: 12, ingredients: [{ name: 'Lemon', amount: '2' }], steps: [{ instruction: 'Zest.' }] });
  const reply = ['Here are three:', fence('recipe-json', r('Lemon-herb salmon')), fence('recipe-json', r('Chickpea bowl')), fence('recipe-json', r('Shrimp linguine')), 'Enjoy!'].join('\n\n');
  const out = parseChatEmbeds(reply, 1000);
  assert(out.recipes.length === 3, 'Chat', 'Every recipe in a reply becomes a savable card, not just the first');
  assert(out.recipes.map(x => x.title).join('|') === 'Lemon-herb salmon|Chickpea bowl|Shrimp linguine', 'Chat', 'Recipes keep their order');
  assert(new Set(out.recipes.map(x => x.id)).size === 3, 'Chat', 'Each recipe gets its own id');
  assert(new Set(out.recipes.flatMap(x => x.ingredients.map(i => i.id))).size === 3, 'Chat', 'Ingredient ids never collide across recipes');
  assert(out.recipes[0].ingredients[0].amount === 2 && out.recipes[0].totalTimeMinutes === 22, 'Chat', 'Amounts and total time are filled as before');
  assert(out.cleanText === 'Here are three:\n\nEnjoy!', 'Chat', 'Blocks are removed from the visible text without leaving gaps');
  const broken = parseChatEmbeds('Try this:\n```recipe-json\n{not json\n```', 1000);
  assert(broken.recipes.length === 0 && broken.cleanText.includes('{not json'), 'Chat', 'A block that fails to parse stays visible');
  const groceries = parseChatEmbeds(fence('grocery-json', [{ name: 'Lime' }]) + '\n' + fence('grocery-json', [{ name: 'Scallions', amount: 3, unit: 'whole', category: 'Produce' }]), 1000);
  assert(groceries.groceryItems?.length === 2 && groceries.groceryItems[1].category === 'Produce' && groceries.groceryItems[0].category === 'Other', 'Chat', 'Grocery blocks are all read and keep their defaults');
  assert(parseChatEmbeds('Just a tip: salt the pasta water.', 1000).recipes.length === 0, 'Chat', 'Plain replies have no cards');
} catch (e: any) {
  results.push({ suite: 'Chat', name: 'Exception in suite', passed: false, error: e.message });
}


// 13. Chef answers pilot (OpenUI Lang)
try {
  assert(checkChefAnswer(CHEF_EXAMPLE).ok, 'Chef answers', 'The example given to the model passes the checks');
  assert(checkChefAnswer('```openui\n' + CHEF_EXAMPLE + '\n```').ok && unwrapChefAnswer('```\nroot = X()\n```') === 'root = X()', 'Chef answers', 'A fenced answer is unwrapped');
  assert(!checkChefAnswer('Sure! Here is a salmon recipe...').ok, 'Chef answers', 'A markdown reply fails, so the server falls back');
  assert(checkChefAnswer(CHEF_EXAMPLE.replace(/^s3 = .*$/m, '')).problems.includes('unresolved:s3'), 'Chef answers', 'A missing definition fails');
  assert(checkChefAnswer(CHEF_EXAMPLE.replace('"Easy", 10, 12', '"Easy", "ten", 12')).problems.includes('type-mismatch'), 'Chef answers', 'A wrong prop type fails');
  const noop = () => {};
  const html = renderToString(createElement(ChefAnswer, { response: CHEF_EXAMPLE, messageId: 'm1', savedIds: new Set(['recipe-ai-m1-0']), savingIds: new Set<string>(), saveErrors: {}, addedGroceryKeys: new Set<string>(), onSave: noop, onCook: noop, onAddGroceries: noop, onAsk: noop }));
  assert(html.includes('Lemon-herb salmon') && html.includes('Crispy chickpea bowl'), 'Chef answers', 'Every recipe in RecipeChoices is drawn');
  assert(html.includes('Saved') && html.includes('Cook in Stories Mode') && html.includes('Save &amp; Cook'), 'Chef answers', 'Saved and unsaved recipes show the right cook button');
  assert(html.includes('22<!-- -->m total') || html.includes('22m total'), 'Chef answers', 'Total time is prep plus cook, as in imported recipes');
  assert(html.includes('Make one of these vegetarian'), 'Chef answers', 'Follow-up questions are drawn');
} catch (e: any) {
  results.push({ suite: 'Chef answers', name: 'Exception in suite', passed: false, error: e.message });
}

// 14. Dinner from what we have (beta answers)
try {
  const ing = (name: string, category = 'Other') => ({ id: name, name, amount: 2, unit: 'lb', category });
  const rec = (id: string, title: string, ingredients: ReturnType<typeof ing>[], useCount = 0) =>
    ({ id, title, description: '', totalTimeMinutes: 35, ingredients, useCount, createdAt: '2026-01-01', userId: 'u1', addedBy: 'Grandma' } as unknown as Recipe);
  const many = Array.from({ length: 200 }, (_, i) => rec('r' + i, 'Recipe ' + i, Array.from({ length: 14 }, (_, j) => ing('Item ' + j)), i));
  const stock: StockItem[] = [
    { id: 's1', name: 'Chicken thighs', place: 'freezer', mealId: 'm1', addedBy: 'Tony' },
    { id: 's2', name: 'Kimchi', place: 'fridge', addedBy: 'Tony' },
  ];
  const meals: PlannedMeal[] = [
    { id: 'm0', recipeId: 'r1', recipeTitle: 'Recipe 1', date: '2026-10-21', servings: 4, addedBy: 'Tony' },
    { id: 'm1', recipeId: 'r2', recipeTitle: 'Recipe 2', date: '2026-10-22', servings: 4, slot: 'lunch', kind: 'leftovers', addedBy: 'Tony' },
    { id: 'm2', recipeId: 'r3', recipeTitle: 'Recipe 3', date: '2026-10-25', servings: 4, addedBy: 'Tony' },
  ];
  const pantry = [
    { id: 'p1', name: 'Olive oil', category: 'Oils & Vinegars', inStock: true },
    { id: 'p2', name: 'Saffron', category: 'Spices & Seasonings', inStock: false },
  ] as PantryItem[];
  const ctx = buildKitchenContext(many, stock, meals, pantry, '2026-10-21');
  assert(ctx.cookbook.length === MAX_CONTEXT_RECIPES && ctx.cookbook[0].id === 'r199', 'Kitchen context', 'Cookbook is capped, most used first');
  assert(ctx.cookbook.every((r) => r.ingredients.length === MAX_CONTEXT_INGREDIENTS), 'Kitchen context', 'Ingredient names are capped per recipe');
  assert(ctx.fridge.join() === 'Kimchi' && ctx.freezer.join() === 'Chicken thighs', 'Kitchen context', 'Fridge and freezer are split by place');
  assert(ctx.planned.map((m) => `${m.day}:${m.slot}:${m.kind}:${m.recipeId}`).join() === 'today:dinner:cook:r1,tomorrow:lunch:leftovers:r2', 'Kitchen context', 'Only today and tomorrow are planned, with defaults');
  assert(ctx.pantry.join() === 'Olive oil', 'Kitchen context', 'Only in-stock pantry items are sent');
  const json = JSON.stringify(ctx);
  assert(!/Tony|Grandma|addedBy|userId|mealId|@|"amount"|"unit"/.test(json), 'Kitchen context', 'No people, accounts or quantities are sent');

  const cookbook = [
    rec('r_8f2', 'Gochujang chicken thighs', [ing('Chicken thighs', 'Meat & Seafood')], 4),
    rec('r_19c', "Mom's Sunday Kimchi Jjigae", [ing('Kimchi')]),
    rec('r_44a', 'Sesame soba with greens', [ing('Soba'), ing('Scallions', 'Produce'), ing('Lime', 'Produce')]),
  ];
  const ids = new Set(cookbook.map((r) => r.id));
  assert(checkChefAnswer(CHEF_TONIGHT_EXAMPLE, ids).ok, 'Kitchen context', 'The tonight example passes the checks');
  const bogus = CHEF_TONIGHT_EXAMPLE.replace('"r_19c"', '"r_made_up"');
  assert(checkChefAnswer(bogus, ids).problems.includes('unknown-recipe:r_made_up'), 'Kitchen context', 'The server check flags a recipe id not in the cookbook');
  const noop = () => {};
  const draw = (response: string) => renderToString(createElement(ChefAnswer, { response, messageId: 'm2', cookbook, savedIds: new Set<string>(), savingIds: new Set<string>(), saveErrors: {}, addedGroceryKeys: new Set<string>(), onSave: noop, onCook: noop, onAddGroceries: noop, onAsk: noop }));
  const tonight = draw(CHEF_TONIGHT_EXAMPLE.replace('"Quickest, about 20 minutes"', '"Ready in 5"'));
  assert(tonight.includes('Gochujang chicken thighs') && tonight.includes('Mom&#x27;s Sunday Kimchi Jjigae') && tonight.includes('Sesame soba with greens'), 'Kitchen context', 'Picks show the real recipe titles');
  assert((tonight.match(/35<!-- -->m total/g) || []).length === 3, 'Kitchen context', 'Times come from the saved recipe');
  assert(tonight.includes('Start cooking') && tonight.includes('Add 2 to grocery list'), 'Kitchen context', 'Each pick can be cooked and missing items added');
  assert(tonight.includes('Thaw now') && tonight.includes('amber'), 'Kitchen context', 'The thaw warning uses the warning tip');
  const dropped = draw(bogus.replace('"r_8f2"', '"Gochujang chicken thighs"'));
  assert(!dropped.includes('Kimchi Jjigae') && !dropped.includes('r_made_up') && !dropped.includes('Gochujang') && dropped.includes('Sesame soba'), 'Kitchen context', 'Unknown recipe ids are dropped, even when the model writes a title');
  const offList = draw(CHEF_TONIGHT_EXAMPLE.replace('["Scallions", "Lime"]', '["Scallions", "Caviar"]'));
  assert(offList.includes('Add 1 to grocery list'), 'Kitchen context', 'Missing items not in the recipe are ignored');
} catch (e: any) {
  results.push({ suite: 'Kitchen context', name: 'Exception in suite', passed: false, error: e.message });
}

// 15. Streaming beta answers
try {
  const S = 'Streaming';
  const bytes = new TextEncoder().encode('Roast at 425°F');
  const split = bytes.indexOf(0xc2) + 1; // cut through the middle of the ° character
  const body = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(bytes.slice(0, split)); c.enqueue(bytes.slice(split)); c.close(); },
  });
  const seen: string[] = [];
  const read = await readTextStream(body, (t) => seen.push(t));
  assert(read === 'Roast at 425°F' && seen.at(-1) === read && seen.every((t) => !t.includes('\uFFFD')), S, 'The assembler joins chunks, even a character split across two');

  async function* gemini(parts: string[], failAt = -1) {
    for (let i = 0; i < parts.length; i++) {
      if (i === failAt) throw new Error('connection reset');
      yield { text: parts[i] };
    }
  }
  const start = await firstTextChunk(gemini(['', 'root = ', 'Answer()']));
  assert(start?.first === 'root = ', S, 'Waits past empty chunks for the first text');
  assert((await firstTextChunk(gemini(['', '']))) === null, S, 'A stream with no text counts as a failed attempt, so the next model is tried');
  let threw = false;
  try { await firstTextChunk(gemini(['x'], 0)); } catch { threw = true; }
  assert(threw, S, 'An error before the first chunk is thrown, so it can be retried');

  const fakeRes = () => {
    const r = { headers: {} as Record<string, string>, body: [] as string[], ended: false,
      setHeader(k: string, v: string) { r.headers[k] = v; }, write(c: string) { r.body.push(c); }, end() { r.ended = true; } };
    return r;
  };
  const ok = fakeRes();
  const opened = (await firstTextChunk(gemini(['a', 'b', '', 'c'])))!;
  const sent = await writeTextStream(ok, opened.first, opened.rest);
  assert(sent === 'abc' && ok.body.join('|') === 'a|b|c' && ok.ended, S, 'Chunks are written as they arrive and the response ends');
  assert(ok.headers['Content-Type'] === 'text/plain; charset=utf-8' && ok.headers['Cache-Control'] === 'no-cache' && ok.headers['X-Accel-Buffering'] === 'no', S, 'Streaming headers that avoid buffering are set');
  const broken = fakeRes();
  const half = (await firstTextChunk(gemini(['a', 'b', 'c'], 2)))!;
  let logged = false;
  const partial = await writeTextStream(broken, half.first, half.rest, () => { logged = true; });
  assert(partial === 'ab' && broken.ended && logged, S, 'An error mid-stream ends the response with what was sent');

  const ids = new Set(['r_8f2', 'r_19c', 'r_44a']);
  const cut = CHEF_TONIGHT_EXAMPLE.slice(0, Math.floor(CHEF_TONIGHT_EXAMPLE.length * 0.6));
  assert(!checkChefAnswer(cut, ids).ok, S, 'A stream that broke off fails the end check, so the app asks for markdown');
  assert(!checkChefAnswer('', ids).ok, S, 'An empty stream falls back too');
  assert(checkChefAnswer('```openui\n' + CHEF_TONIGHT_EXAMPLE + '\n```', ids).ok, S, 'A complete fenced answer is kept');
  assert(unwrapChefAnswer('```openui\nroot = Answer("Hi"') === 'root = Answer("Hi"', S, 'A half-streamed fence is unwrapped for the renderer');

  const cookbook = [
    { id: 'r_8f2', title: 'Gochujang chicken thighs', totalTimeMinutes: 35, ingredients: [] },
    { id: 'r_44a', title: 'Sesame soba', totalTimeMinutes: 20, ingredients: [{ id: 'x', name: 'Scallions', amount: 1, unit: '', category: 'Produce' }] },
  ] as unknown as Recipe[];
  const noop = () => {};
  const draw = (response: string, isStreaming: boolean) => renderToString(createElement(ChefAnswer, { response, isStreaming, messageId: 'm3', cookbook, savedIds: new Set<string>(), savingIds: new Set<string>(), saveErrors: {}, addedGroceryKeys: new Set<string>(), onSave: noop, onCook: noop, onAddGroceries: noop, onAsk: noop }));
  const upTo = CHEF_TONIGHT_EXAMPLE.indexOf('thaw =');
  const live = draw('```openui\n' + CHEF_TONIGHT_EXAMPLE.slice(0, upTo), true);
  assert(live.includes('Gochujang chicken thighs') && /<button disabled=""[^>]*>(?:(?!<\/button>).)*Start cooking/.test(live), S, 'A half-streamed answer draws, with its buttons disabled');
  const done = draw(CHEF_TONIGHT_EXAMPLE, false);
  assert(done.includes('Start cooking') && !/<button disabled=""[^>]*>(?:(?!<\/button>).)*Start cooking/.test(done), S, 'Buttons work once the answer is complete');
} catch (e: any) {
  results.push({ suite: 'Streaming', name: 'Exception in suite', passed: false, error: e.message });
}

// Output Summary
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
