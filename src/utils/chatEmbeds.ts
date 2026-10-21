import { Recipe, GroceryItem } from '../types/recipe.ts';

// Chef chat replies can carry ```recipe-json``` and ```grocery-json``` blocks.
// A reply may hold several recipes ("give me 3 recipes"), so every block is read, not just the first.
const RECIPE_BLOCK = /```recipe-json\s*([\s\S]*?)\s*```/g;
const GROCERY_BLOCK = /```grocery-json\s*([\s\S]*?)\s*```/g;

const toRecipe = (rawObj: any, id: string, nowIso: string): Recipe => ({
  id,
  title: rawObj.title || 'Untitled Recipe',
  description: rawObj.description || '',
  cuisine: rawObj.cuisine || 'Continental',
  difficulty: rawObj.difficulty || 'Intermediate',
  prepTimeMinutes: rawObj.prepTimeMinutes || 15,
  cookTimeMinutes: rawObj.cookTimeMinutes || 20,
  totalTimeMinutes: (rawObj.prepTimeMinutes || 15) + (rawObj.cookTimeMinutes || 20),
  defaultServings: rawObj.defaultServings || 2,
  heroImage: '',
  tags: rawObj.tags || ['Chef AI'],
  ingredients: (rawObj.ingredients || []).map((ing: any, i: number) => ({
    id: `${id}-ing-${i}`,
    name: ing.name || 'Ingredient',
    amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 1,
    unit: ing.unit || '',
    category: ing.category || 'Other',
    notes: ing.notes || '',
  })),
  steps: (rawObj.steps || []).map((st: any, i: number) => ({
    stepNumber: i + 1,
    title: st.title || `Step ${i + 1}`,
    instruction: st.instruction || '',
    timerSeconds: st.timerSeconds || 0,
    temperature: st.temperature || '',
    tips: st.tips || '',
  })),
  source: {
    type: 'manual',
    sourceName: 'Created with Gemini AI',
  },
  createdAt: nowIso,
  updatedAt: nowIso,
});

export const parseChatEmbeds = (text: string, nowMs: number = Date.now()) => {
  const nowIso = new Date(nowMs).toISOString();
  const recipes: Recipe[] = [];
  let groceryItems: Partial<GroceryItem>[] | undefined;

  // A block that fails to parse stays in the text, so the reader still sees it.
  let cleanText = text.replace(RECIPE_BLOCK, (block, json) => {
    try {
      recipes.push(toRecipe(JSON.parse(json), `recipe-ai-${nowMs}-${recipes.length}`, nowIso));
      return '';
    } catch (e) {
      console.warn('Failed to parse recipe-json from Gemini:', e);
      return block;
    }
  });

  cleanText = cleanText.replace(GROCERY_BLOCK, (block, json) => {
    try {
      const rawItems = JSON.parse(json);
      if (!Array.isArray(rawItems)) return '';
      groceryItems = [
        ...(groceryItems || []),
        ...rawItems.map((item: any) => ({
          name: item.name,
          amount: item.amount || null,
          unit: item.unit || '',
          category: item.category || 'Other',
          assignedTo: 'Anyone',
        })),
      ];
      return '';
    } catch (e) {
      console.warn('Failed to parse grocery-json from Gemini:', e);
      return block;
    }
  });

  return { cleanText: cleanText.replace(/\n{3,}/g, '\n\n').trim(), recipes, groceryItems };
};
