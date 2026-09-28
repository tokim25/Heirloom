import { GroceryItem } from '../types/recipe.ts';

const UNIT_ALIASES: Record<string, string> = {
  c: 'cup',
  cups: 'cup',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsps: 'tbsp',
  tbs: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsps: 'tsp',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  ounce: 'oz',
  ounces: 'oz',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  milliliter: 'ml',
  milliliters: 'ml',
  liter: 'l',
  liters: 'l',
  cloves: 'clove',
  slices: 'slice',
  cans: 'can',
  bunches: 'bunch',
  pieces: 'piece',
};

/** Lowercase, drop notes in brackets, and reduce plurals so "Eggs" and "egg" match. */
export function normalizeItemName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base
    .split(' ')
    .map((word) => {
      if (word.length <= 3) return word;
      if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
      if (word.endsWith('oes')) return word.slice(0, -2);
      if (word.endsWith('ss') || word.endsWith('us')) return word;
      if (word.endsWith('s')) return word.slice(0, -1);
      return word;
    })
    .join(' ');
}

export function normalizeUnit(unit: string): string {
  const clean = unit.toLowerCase().trim().replace(/\.$/, '');
  return UNIT_ALIASES[clean] ?? clean;
}

export interface MergeableItem {
  name: string;
  amount: number | null;
  unit: string;
  recipeTitle?: string;
}

export interface MergePlan<T extends MergeableItem> {
  /** New lines to add to the list. */
  toAdd: T[];
  /** Existing lines whose quantity (and source recipes) should change. */
  toUpdate: { id: string; amount: number | null; recipeTitle?: string }[];
  /** How many incoming ingredients were folded into something already there. */
  combined: number;
}

const roundQuantity = (n: number) => Math.round(n * 1000) / 1000;

const mergeTitles = (current?: string, incoming?: string) => {
  if (!incoming) return current;
  if (!current) return incoming;
  const parts = current.split(', ').map((p) => p.trim());
  return parts.includes(incoming) ? current : `${current}, ${incoming}`;
};

/**
 * Works out how to add ingredients to a list without repeating lines. An ingredient combines with an
 * unchecked item of the same name and unit (1 lb beef + 2 lb beef = 3 lb). Different units stay separate
 * because they cannot be added reliably (a tsp of salt and a cup of salt), and checked items are never
 * touched because they were already bought.
 */
export function planGroceryMerge<T extends MergeableItem>(existing: GroceryItem[], incoming: T[]): MergePlan<T> {
  type Slot = { key: string; id?: string; amount: number | null; recipeTitle?: string; changed: boolean; incomingIndex?: number };
  const slots = new Map<string, Slot>();
  const toAdd: T[] = [];
  let combined = 0;

  const keyFor = (name: string, unit: string) => `${normalizeItemName(name)}|${normalizeUnit(unit)}`;

  for (const item of existing) {
    if (item.checked) continue;
    const key = keyFor(item.name, item.unit);
    if (!slots.has(key)) slots.set(key, { key, id: item.id, amount: item.amount, recipeTitle: item.recipeTitle, changed: false });
  }

  const addedSlots: { item: T; slot: Slot }[] = [];

  for (const item of incoming) {
    const key = keyFor(item.name, item.unit);
    const slot = slots.get(key);
    if (!slot) {
      const fresh: Slot = { key, amount: item.amount, recipeTitle: item.recipeTitle, changed: false };
      slots.set(key, fresh);
      addedSlots.push({ item: { ...item }, slot: fresh });
      continue;
    }
    combined += 1;
    if (slot.amount !== null && item.amount !== null) {
      slot.amount = roundQuantity(slot.amount + item.amount);
      slot.changed = true;
    } else if (slot.amount === null && item.amount !== null) {
      slot.amount = item.amount;
      slot.changed = true;
    }
    const titles = mergeTitles(slot.recipeTitle, item.recipeTitle);
    if (titles !== slot.recipeTitle) {
      slot.recipeTitle = titles;
      slot.changed = true;
    }
  }

  for (const { item, slot } of addedSlots) {
    toAdd.push({ ...item, amount: slot.amount, recipeTitle: slot.recipeTitle });
  }

  const toUpdate = [...slots.values()]
    .filter((slot) => slot.id && slot.changed)
    .map((slot) => ({ id: slot.id as string, amount: slot.amount, recipeTitle: slot.recipeTitle }));

  return { toAdd, toUpdate, combined };
}
