import { z } from 'zod/v4';
import { defineComponent, createLibrary, createParser } from '@openuidev/lang-core';

// The components Chef chat answers may use, as OpenUI Lang (openui.com).
// This file holds names, props and descriptions only, so the server can build the
// system prompt and check replies without React. The renderers live in
// src/components/chef/ChefAnswer.tsx and reuse these definitions.

const CATEGORIES = ['Produce', 'Dairy & Refrigerated', 'Meat & Seafood', 'Pantry & Spices', 'Bakery', 'Frozen', 'Other'] as const;

export const Ingredient = defineComponent({
  name: 'Ingredient',
  description: 'One ingredient line inside a Recipe. amount is a number (0.5, not "1/2"); use 0 when there is no amount, e.g. salt "to taste" in notes.',
  props: z.object({
    name: z.string(),
    amount: z.number(),
    unit: z.string(),
    category: z.enum(CATEGORIES),
    notes: z.string().optional(),
  }),
  component: null,
});

export const Step = defineComponent({
  name: 'Step',
  description: 'One method step inside a Recipe. timerSeconds is 0 when the step has no wait.',
  props: z.object({
    title: z.string(),
    instruction: z.string(),
    timerSeconds: z.number(),
    temperature: z.string().optional(),
  }),
  component: null,
});

export const Recipe = defineComponent({
  name: 'Recipe',
  description: 'A complete recipe the user can save or cook. Only used inside RecipeChoices.',
  props: z.object({
    title: z.string(),
    description: z.string(),
    cuisine: z.string(),
    difficulty: z.enum(['Easy', 'Intermediate', 'Advanced']),
    prepTimeMinutes: z.number().describe('Hands-on prep time'),
    cookTimeMinutes: z.number(),
    defaultServings: z.number(),
    ingredients: z.array(Ingredient.ref),
    steps: z.array(Step.ref),
    tags: z.array(z.string()).optional(),
  }),
  component: null,
});

export const RecipeChoices = defineComponent({
  name: 'RecipeChoices',
  description: 'One or more complete recipes shown as cards the user can tick, save to their cookbook, or cook. Use whenever the reply contains a recipe.',
  props: z.object({
    recipes: z.array(Recipe.ref),
  }),
  component: null,
});

export const GroceryItem = defineComponent({
  name: 'GroceryItem',
  description: 'One shopping-list item inside a GroceryList. amount is 0 when there is no amount.',
  props: z.object({
    name: z.string(),
    amount: z.number(),
    unit: z.string(),
    category: z.enum(CATEGORIES),
  }),
  component: null,
});

export const GroceryList = defineComponent({
  name: 'GroceryList',
  description: 'Items the user can add to their shared grocery list in one tap.',
  props: z.object({
    items: z.array(GroceryItem.ref),
  }),
  component: null,
});

export const CookbookPick = defineComponent({
  name: 'CookbookPick',
  description: 'One of the household\'s own recipes, inside CookbookPicks. recipeId is copied exactly from the cookbook in [Kitchen Context]. reason is one short line on why it fits tonight. missing lists that recipe\'s ingredient names (as written in the context) that are not in the fridge, freezer or pantry; [] when they have it all. Names only, no amounts.',
  props: z.object({
    recipeId: z.string(),
    reason: z.string(),
    missing: z.array(z.string()),
  }),
  component: null,
});

export const CookbookPicks = defineComponent({
  name: 'CookbookPicks',
  description: 'Up to 3 recipes from the household\'s own cookbook, best first. The app shows each recipe\'s real title and time with Start cooking and Add to grocery list buttons.',
  props: z.object({
    picks: z.array(CookbookPick.ref),
  }),
  component: null,
});

export const Text = defineComponent({
  name: 'Text',
  description: 'A short paragraph of plain text. **bold** is allowed.',
  props: z.object({ text: z.string() }),
  component: null,
});

export const Tip = defineComponent({
  name: 'Tip',
  description: 'A short highlighted note: a substitution, technique tip, or warning. tone "warning" for food-safety or timing warnings.',
  props: z.object({
    title: z.string(),
    text: z.string(),
    tone: z.enum(['info', 'warning']).optional(),
  }),
  component: null,
});

export const FollowUps = defineComponent({
  name: 'FollowUps',
  description: 'Two or three short follow-up questions the user might ask next, written in their voice. Tapping one sends it.',
  props: z.object({ questions: z.array(z.string()) }),
  component: null,
});

export const Answer = defineComponent({
  name: 'Answer',
  description: 'Every reply. title is a short headline. children are the parts of the reply, in order. subtitle is an optional one-line summary.',
  props: z.object({
    title: z.string(),
    children: z.array(z.union([Text.ref, Tip.ref, CookbookPicks.ref, RecipeChoices.ref, GroceryList.ref, FollowUps.ref])),
    subtitle: z.string().optional(),
  }),
  component: null,
});

export const CHEF_COMPONENTS = [Answer, Text, Tip, CookbookPicks, CookbookPick, RecipeChoices, Recipe, Ingredient, Step, GroceryList, GroceryItem, FollowUps];

/** The worked example given to the model, also used by the tests. */
export const CHEF_EXAMPLE = `root = Answer("2 quick dinners", [intro, picks, swap, more], "Under 15 minutes of prep")
intro = Text("Both use pantry staples and one pan.")
picks = RecipeChoices([r1, r2])
r1 = Recipe("Lemon-herb salmon", "Bright, flaky and fast.", "Mediterranean", "Easy", 10, 12, 2, [i1, i2, i3], [s1, s2], ["Quick", "One-Pan"])
i1 = Ingredient("Salmon fillets", 2, "whole", "Meat & Seafood")
i2 = Ingredient("Lemon", 1, "whole", "Produce", "zested and juiced")
i3 = Ingredient("Salt", 0, "", "Pantry & Spices", "to taste")
s1 = Step("Season", "Pat the salmon dry and season with salt and lemon zest.", 0)
s2 = Step("Roast", "Roast until it flakes easily.", 720, "425°F")
r2 = Recipe("Crispy chickpea bowl", "Golden chickpeas over greens.", "Mediterranean", "Easy", 8, 10, 2, [i4], [s3])
i4 = Ingredient("Chickpeas", 1, "can", "Pantry & Spices", "drained")
s3 = Step("Crisp", "Pan-fry the chickpeas in olive oil until golden.", 480)
swap = Tip("Swap", "No salmon? Any firm white fish works at the same timing.")
more = FollowUps(["Make one of these vegetarian", "Add the ingredients to my grocery list"])`;

/** The second worked example: dinner from the household's own cookbook. IDs match the sample context in the tests. */
export const CHEF_TONIGHT_EXAMPLE = `root = Answer("Tonight: 3 dinners from what you have", [picks, thaw, more], "From your cookbook, checked against the fridge and freezer")
picks = CookbookPicks([p1, p2, p3])
p1 = CookbookPick("r_8f2", "Uses the chicken thighs in the freezer", [])
p2 = CookbookPick("r_19c", "Kimchi and tofu are in the fridge", [])
p3 = CookbookPick("r_44a", "Quickest, about 20 minutes", ["Scallions", "Lime"])
thaw = Tip("Thaw now", "The chicken thighs for the first pick are in the freezer. Move them to the fridge now, or use cold water for about an hour.", "warning")
more = FollowUps(["Something without chicken", "Add what's missing to my grocery list"])`;

export const chefPromptLibrary = createLibrary({ components: CHEF_COMPONENTS, root: 'Answer' });

const parser = createParser(chefPromptLibrary.toJSONSchema(), chefPromptLibrary.root);

/** Models sometimes wrap the program in a ``` fence; the renderer wants the bare program. Works on a half-streamed answer too. */
export const unwrapChefAnswer = (text: string) =>
  text.trim().replace(/^```[\w-]*[ \t]*\n/, '').replace(/\n```$/, '').trim();

/** Every CookbookPick recipeId in a parsed answer. */
const pickedRecipeIds = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(pickedRecipeIds);
  if (!node || typeof node !== 'object') return [];
  const n = node as { typeName?: string; props?: Record<string, unknown> };
  const own = n.typeName === 'CookbookPick' ? [String(n.props?.recipeId ?? '')] : [];
  return [...own, ...Object.values(n.props ?? {}).flatMap(pickedRecipeIds)];
};

/**
 * Checks a Chef reply before it reaches the page. A reply passes when it has an Answer root,
 * no component was dropped for missing or mistyped props, and every CookbookPick names a
 * recipe in cookbookIds (the IDs sent in the kitchen context).
 */
export const checkChefAnswer = (text: string, cookbookIds: ReadonlySet<string> = new Set()) => {
  const result = parser.parse(unwrapChefAnswer(text));
  const problems = [
    ...(result.root?.typeName === 'Answer' ? [] : ['no-root']),
    ...result.meta.errors.map((e) => e.code),
    ...result.meta.unresolved.map((name) => `unresolved:${name}`),
    ...pickedRecipeIds(result.root).filter((id) => !cookbookIds.has(id)).map((id) => `unknown-recipe:${id}`),
  ];
  return { ok: problems.length === 0, problems };
};
