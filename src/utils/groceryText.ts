import { GroceryItem } from '../types/recipe.ts';
import { formatFraction } from './units.ts';

/** Store-walk order, so a printed or shared list follows the shop. */
export const AISLE_ORDER: GroceryItem['category'][] = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Refrigerated',
  'Bakery',
  'Pantry & Spices',
  'Frozen',
  'Other',
];

export function groupByAisle<T extends { category: GroceryItem['category'] }>(items: T[]): { aisle: GroceryItem['category']; items: T[] }[] {
  return AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((item) => (item.category || 'Other') === aisle) })).filter(
    (group) => group.items.length > 0
  );
}

export const describeQuantity = (item: Pick<GroceryItem, 'amount' | 'unit'>) => {
  const qty = formatFraction(item.amount);
  return [qty, item.unit].filter(Boolean).join(' ');
};

/** Plain-text list, grouped by aisle, for Notes, Messages or a partner. Only items still to buy. */
export function formatGroceryList(title: string, store: string | undefined, items: GroceryItem[]): string {
  const remaining = items.filter((item) => !item.checked);
  if (remaining.length === 0) return `${title}\nNothing left to buy.`;
  const header = store ? `${title} (${store})` : title;
  const sections = groupByAisle(remaining).map(({ aisle, items: group }) => {
    const lines = group.map((item) => {
      const qty = describeQuantity(item);
      return `• ${qty ? `${qty} ` : ''}${item.name}`;
    });
    return `${aisle}\n${lines.join('\n')}`;
  });
  return `${header}\n\n${sections.join('\n\n')}`;
}
