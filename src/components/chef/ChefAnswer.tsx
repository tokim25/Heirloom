import React, { createContext, useContext, useState } from 'react';
import { Renderer, createLibrary, defineComponent } from '@openuidev/react-lang';
import { Check, ChefHat, Loader2, Plus, ShoppingBag } from 'lucide-react';
import { z } from 'zod/v4';
import { GroceryItem, Recipe } from '../../types/recipe.ts';
import { normalizeParsedRecipe } from '../../utils/recipeSchema.ts';
import * as spec from '../../utils/chefLibrary.ts';

// Draws a Chef chat answer written in OpenUI Lang with Heirloom's own components.
// The component names and props come from src/utils/chefLibrary.ts; only the drawing lives here.

interface ChefActions {
  messageId: string;
  savedIds: Set<string>;
  savingIds: Set<string>;
  saveErrors: Record<string, string>;
  addedGroceryKeys: Set<string>;
  /** The household's recipes. CookbookPicks draws only recipes found here. */
  cookbook?: Recipe[];
  onSave: (recipe: Recipe) => void;
  onCook?: (recipe: Recipe) => void;
  onAddGroceries: (key: string, items: Partial<GroceryItem>[]) => void;
  onAsk: (text: string) => void;
}

const ActionsContext = createContext<ChefActions | null>(null);
const useActions = () => useContext(ActionsContext)!;

type Node = { props: Record<string, any> } | null | undefined;
const propsOf = (nodes: unknown): Record<string, any>[] =>
  (Array.isArray(nodes) ? (nodes as Node[]) : []).map((n) => n?.props).filter((p): p is Record<string, any> => !!p);

/** Same bold-only formatting as the markdown chat. */
const Rich = ({ text }: { text: string }) => (
  <>
    {String(text ?? '').split(/(\*\*.*?\*\*)/).map((chunk, i) =>
      chunk.startsWith('**') && chunk.endsWith('**') ? (
        <strong key={i} className="font-semibold text-stone-950">{chunk.slice(2, -2)}</strong>
      ) : (
        chunk
      ),
    )}
  </>
);

/** A Recipe node becomes a normal Heirloom recipe, the same way an imported recipe does. Null if it isn't usable yet. */
const toRecipe = (p: Record<string, any>, id: string): Recipe | null => {
  try {
    const fields = normalizeParsedRecipe({ ...p, ingredients: propsOf(p.ingredients), steps: propsOf(p.steps) });
    const now = new Date().toISOString();
    return {
      ...fields,
      id,
      tags: Array.isArray(p.tags) && p.tags.length ? p.tags.map(String) : ['Chef AI'],
      heroImage: '',
      source: { type: 'manual', sourceName: 'Created with Gemini AI' },
      createdAt: now,
      updatedAt: now,
    };
  } catch {
    return null;
  }
};

const Answer = defineComponent({
  ...spec.Answer,
  component: ({ props, renderNode }) => (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-serif text-lg font-medium text-stone-900 leading-snug">{props.title}</h3>
        {props.subtitle && <p className="text-xs text-stone-500 mt-0.5">{props.subtitle}</p>}
      </div>
      {renderNode(props.children)}
    </div>
  ),
});

const Text = defineComponent({
  ...spec.Text,
  component: ({ props }) => (
    <p className="whitespace-pre-wrap">
      <Rich text={props.text} />
    </p>
  ),
});

const Tip = defineComponent({
  ...spec.Tip,
  component: ({ props }) => (
    <div
      className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
        props.tone === 'warning'
          ? 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800/50'
          : 'bg-stone-50 text-stone-700 border border-stone-200'
      }`}
    >
      <span className="font-semibold">{props.title}.</span> <Rich text={props.text} />
    </div>
  ),
});

const RecipeChoices = defineComponent({
  ...spec.RecipeChoices,
  component: ({ props }) => {
    const { messageId, savedIds, savingIds, saveErrors, onSave, onCook } = useActions();
    const recipes = propsOf(props.recipes)
      .map((p, i) => toRecipe(p, `recipe-ai-${messageId}-${i}`))
      .filter((r): r is Recipe => r !== null);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    if (!recipes.length) return null;

    const multiple = recipes.length > 1;
    const toSave = (multiple ? recipes.filter((r) => picked.has(r.id)) : recipes).filter((r) => !savedIds.has(r.id));
    const saving = recipes.some((r) => savingIds.has(r.id));
    const toggle = (id: string) =>
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

    return (
      <fieldset className="flex flex-col gap-2 min-w-0">
        <legend className="sr-only">{multiple ? 'Pick the recipes you want' : 'Recipe'}</legend>
        <div className={`grid gap-2 ${multiple ? 'sm:grid-cols-2' : ''}`}>
          {recipes.map((r) => {
            const saved = savedIds.has(r.id);
            const isPicked = picked.has(r.id);
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-3 flex flex-col gap-2 bg-surface ${
                  isPicked ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/30' : 'border-stone-200'
                }`}
              >
                <label className={`flex items-start gap-2 ${multiple && !saved ? 'cursor-pointer' : ''}`}>
                  {multiple && !saved && (
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => toggle(r.id)}
                      className="mt-1 h-4 w-4 accent-amber-500"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block font-serif text-base font-semibold text-stone-900 leading-snug">{r.title}</span>
                    <span className="block text-xs text-stone-500 mt-0.5">
                      {r.prepTimeMinutes}m prep • {r.totalTimeMinutes}m total • {r.ingredients.length} ingredients • {r.difficulty}
                    </span>
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  {saved && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <Check className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                  {onCook && (
                    <button
                      onClick={() => onCook(r)}
                      disabled={savingIds.has(r.id)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                    >
                      <ChefHat className="w-3.5 h-3.5" />
                      {saved ? 'Cook in Stories Mode' : 'Save & Cook'}
                    </button>
                  )}
                </div>
                {saveErrors[r.id] && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50">
                    {saveErrors[r.id]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {(toSave.length > 0 || multiple) && recipes.some((r) => !savedIds.has(r.id)) && (
          <button
            onClick={() => toSave.forEach(onSave)}
            disabled={toSave.length === 0 || saving}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 bg-ink hover:bg-ink-hover text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {saving
              ? 'Saving to Cookbook...'
              : toSave.length === 0
              ? 'Pick the recipes to save'
              : `Save ${toSave.length === 1 && !multiple ? '' : `${toSave.length} `}to Cookbook`}
          </button>
        )}
      </fieldset>
    );
  },
});

const CookbookPicks = defineComponent({
  ...spec.CookbookPicks,
  component: ({ props }) => {
    const { messageId, cookbook = [], addedGroceryKeys, onCook, onAddGroceries } = useActions();
    // Title, times and ingredients come from the saved recipe; an id not in the cookbook is dropped.
    const picks = propsOf(props.picks).flatMap((p) => {
      const recipe = cookbook.find((r) => r.id === p.recipeId);
      if (!recipe) return [];
      const wanted = new Set((Array.isArray(p.missing) ? p.missing : []).map((m: unknown) => String(m).trim().toLowerCase()));
      const missing = recipe.ingredients.filter((i) => wanted.has(i.name.trim().toLowerCase()));
      return [{ recipe, reason: String(p.reason ?? ''), missing, haveAll: wanted.size === 0 }];
    });
    if (!picks.length) return null;
    return (
      <ol className="flex flex-col gap-2">
        {picks.map(({ recipe, reason, missing, haveAll }, i) => {
          const key = `${messageId}-pick-${recipe.id}`;
          const added = addedGroceryKeys.has(key);
          return (
            <li key={recipe.id} className="rounded-xl border border-stone-200 p-3 flex flex-col gap-2 bg-surface">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 shrink-0 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-serif text-base font-semibold text-stone-900 leading-snug">{recipe.title}</span>
                  <span className="block text-xs text-stone-500 mt-0.5">
                    {recipe.totalTimeMinutes}m total
                    {missing.length ? ` • Missing ${missing.length}` : haveAll ? ' • Have it all' : ''}
                  </span>
                  {reason && <span className="block text-xs text-stone-600 mt-1">{reason}</span>}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onCook && (
                  <button
                    onClick={() => onCook(recipe)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink hover:bg-ink-hover text-white px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <ChefHat className="w-3.5 h-3.5" /> Start cooking
                  </button>
                )}
                {missing.length > 0 && (
                  <button
                    onClick={() =>
                      onAddGroceries(
                        key,
                        missing.map((m) => ({
                          name: m.name,
                          amount: null,
                          unit: '',
                          category: m.category,
                          assignedTo: 'Anyone',
                          recipeId: recipe.id,
                          recipeTitle: recipe.title,
                        })),
                      )
                    }
                    disabled={added}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-60 disabled:cursor-default"
                  >
                    {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {added ? 'Added to your grocery list' : `Add ${missing.length} to grocery list`}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  },
});

const GroceryList = defineComponent({
  ...spec.GroceryList,
  component: ({ props }) => {
    const { messageId, addedGroceryKeys, onAddGroceries } = useActions();
    const items = propsOf(props.items).map((it) => ({
      name: String(it.name ?? ''),
      amount: Number(it.amount) > 0 ? Number(it.amount) : null,
      unit: String(it.unit ?? ''),
      category: it.category,
      assignedTo: 'Anyone',
    }));
    if (!items.length) return null;
    const key = `${messageId}-groceries`;
    const added = addedGroceryKeys.has(key);
    return (
      <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex flex-col gap-2.5 dark:bg-emerald-950/40 dark:border-emerald-800/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
            Suggested Shopping Items ({items.length})
          </span>
          <ShoppingBag className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
        </div>
        <ul className="text-xs text-stone-700 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>
                {item.amount ? `${item.amount} ${item.unit} ` : ''}
                <strong>{item.name}</strong> ({item.category})
              </span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => onAddGroceries(key, items)}
          disabled={added}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
            added ? 'bg-emerald-700 text-white cursor-default' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {added ? 'Added to your grocery list' : 'Add Items to Grocery List'}
        </button>
      </div>
    );
  },
});

const FollowUps = defineComponent({
  ...spec.FollowUps,
  component: ({ props }) => {
    const { onAsk } = useActions();
    const questions = (Array.isArray(props.questions) ? props.questions : []).map(String).filter(Boolean);
    if (!questions.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q) => (
          <button
            key={q}
            onClick={() => onAsk(q)}
            className="px-3 py-1.5 rounded-full bg-surface border border-stone-200 hover:border-amber-400 text-xs text-stone-700 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    );
  },
});

// CookbookPick, Recipe, Ingredient, Step and GroceryItem are data nodes read by their parents, never drawn alone.
const dataOnly = <T extends z.ZodObject>(d: { name: string; props: T; description: string }) =>
  defineComponent({ name: d.name, props: d.props, description: d.description, component: () => null });

const chefLibrary = createLibrary({
  components: [
    Answer,
    Text,
    Tip,
    CookbookPicks,
    RecipeChoices,
    GroceryList,
    FollowUps,
    dataOnly(spec.CookbookPick),
    dataOnly(spec.Recipe),
    dataOnly(spec.Ingredient),
    dataOnly(spec.Step),
    dataOnly(spec.GroceryItem),
  ],
  root: 'Answer',
});

export const ChefAnswer: React.FC<ChefActions & { response: string }> = ({ response, ...actions }) => (
  <ActionsContext.Provider value={actions}>
    <Renderer response={response} library={chefLibrary} isStreaming={false} />
  </ActionsContext.Provider>
);

export default ChefAnswer;
