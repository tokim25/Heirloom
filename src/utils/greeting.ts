import { PlannedMeal } from '../types/recipe.ts';
import { kindOf, slotOf } from './mealPlan.ts';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const timeOfDay = (hour: number): TimeOfDay =>
  hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night';

/** "Good evening, Tony", or just "Good evening" when there is no name. Late at night it keeps it short. */
export function greeting(hour: number, name?: string): string {
  const first = name?.trim().split(/\s+/)[0];
  const phrase = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Still up' }[timeOfDay(hour)];
  return first ? `${phrase}, ${first}` : phrase;
}

/**
 * Tonight's planned dinner, once it is midday or later (earlier than that, dinner is not what people are thinking
 * about). Leftover nights are skipped: there is nothing to cook.
 */
export function tonightsDinner(meals: PlannedMeal[], todayKey: string, hour: number): PlannedMeal | null {
  if (hour < 12) return null;
  return meals.find((m) => m.date === todayKey && slotOf(m) === 'dinner' && kindOf(m) !== 'leftovers') ?? null;
}
