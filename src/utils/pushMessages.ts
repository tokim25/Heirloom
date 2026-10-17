import { PlannedMeal, StockItem, User } from '../types/recipe.ts';
import { slotOf, kindOf } from './mealPlan.ts';
import { thawTonight } from './stock.ts';
import { addDays } from './mealPlan.ts';

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping the notification goes. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
}

export type PushKind = 'inbox' | 'dinner';

/** Both kinds are on by default once notifications are turned on. */
export const wantsPush = (prefs: User['pushPrefs'], kind: PushKind): boolean => prefs?.[kind] !== false;

/** Today's date as YYYY-MM-DD in a given IANA time zone (the server runs in UTC, people do not). */
export function dateKeyInZone(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
}

export const inboxMessage = (fromName: string, recipeTitle: string): PushMessage => ({
  title: `${fromName || 'Someone'} sent you a recipe`,
  body: recipeTitle,
  url: '/inbox',
  tag: 'inbox',
});

const listNames = (names: string[]): string =>
  names.length <= 1 ? names[0] ?? '' : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * The morning reminder: what is for dinner tonight, plus anything in the freezer to take out for tomorrow's dinner.
 * Returns null when there is nothing worth interrupting someone for.
 */
export function dinnerMessage(meals: PlannedMeal[], stock: StockItem[], todayKey: string): PushMessage | null {
  const tonight = meals.filter((m) => m.date === todayKey && slotOf(m) === 'dinner');
  const cooking = tonight.filter((m) => kindOf(m) !== 'leftovers');
  const leftovers = tonight.filter((m) => kindOf(m) === 'leftovers');
  const thaw = thawTonight(stock, meals, todayKey);
  if (tonight.length === 0 && thaw.length === 0) return null;

  const lines: string[] = [];
  let title: string;
  if (cooking.length > 0) {
    title = `Tonight: ${listNames(cooking.map((m) => m.recipeTitle))}`;
    const serves = cooking[0].servings;
    if (cooking.length === 1) lines.push(`For ${serves} ${serves === 1 ? 'person' : 'people'}.`);
  } else if (leftovers.length > 0) {
    title = `Leftovers tonight: ${listNames(leftovers.map((m) => m.recipeTitle))}`;
  } else {
    title = 'Nothing to cook tonight';
  }
  if (thaw.length > 0) {
    const tomorrow = meals.filter((m) => m.date === addDays(todayKey, 1) && thaw.some((t) => t.mealId === m.id));
    const forWhat = tomorrow.length === 1 ? ` for tomorrow's ${tomorrow[0].recipeTitle}` : ' for tomorrow';
    lines.push(`Take ${listNames(thaw.map((t) => t.name))} out of the freezer tonight${forWhat}.`);
  }
  return { title, body: lines.join(' '), url: '/plan', tag: 'dinner' };
}
