import { Ingredient, RecipeStep } from '../types/recipe.ts';
import { stem, words } from './stepIngredients.ts';

/*
 * Everything the cooking screen shows beyond the step text is worked out here from the recipe itself: nothing is invented.
 * Where something is general kitchen safety rather than part of the recipe, it is labelled as such by the caller.
 */

/** 3:05:00 for long timers, 17:58 for short ones. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** "12 hr", "45 min", "1 hr 30 min", "1 min 30 sec". */
export function formatDurationWords(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  if (m > 0) return sec > 0 && m < 5 ? `${m} min ${sec} sec` : `${m} min`;
  return `${sec} sec`;
}

/** Every timer in the recipe added together: how much of the recipe is waiting. */
export const totalWaitSeconds = (steps: Pick<RecipeStep, 'timerSeconds'>[]): number =>
  steps.reduce((sum, step) => sum + (step.timerSeconds && step.timerSeconds > 0 ? step.timerSeconds : 0), 0);

/** A short label for a step in a timer chip: its title, or its first few words ("Cook the rice"). */
export function stepLabel(step: Pick<RecipeStep, 'title' | 'instruction' | 'stepNumber'>): string {
  const title = step.title?.trim();
  if (title) return title;
  const text = step.instruction.replace(/\s+/g, ' ').trim();
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const trimmed = firstSentence.replace(/[.!?]+$/, '');
  return trimmed.length > 34 ? `${trimmed.slice(0, 32).trimEnd()}…` : trimmed || `Step ${step.stepNumber}`;
}

/** The next step in a line, for "while you wait, next up". */
export function nextUp(steps: Pick<RecipeStep, 'title' | 'instruction'>[], index: number): string | null {
  const next = steps[index + 1];
  if (!next) return null;
  const text = next.instruction.replace(/\s+/g, ' ').trim();
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return firstSentence.length > 110 ? `${firstSentence.slice(0, 108).trimEnd()}…` : firstSentence;
}

const EQUIPMENT: [RegExp, string][] = [
  [/\bdutch oven\b/i, 'Dutch oven'],
  [/\bwok\b/i, 'Wok'],
  [/\b(cast[- ]iron|skillet|frying pan|saute pan|sauté pan)\b/i, 'Skillet'],
  [/\b(stockpot|large pot|saucepan|medium pot|small pot)\b/i, 'Pot'],
  [/\broasting pan\b/i, 'Roasting pan'],
  [/\b(baking sheet|sheet pan|baking tray)\b/i, 'Baking sheet'],
  [/\b(wire rack|cooling rack)\b/i, 'Wire rack'],
  [/\bparchment\b/i, 'Parchment paper'],
  [/\b(aluminum foil|foil)\b/i, 'Foil'],
  [/\b(mixing bowl|large bowl|small bowl|medium bowl)\b/i, 'Mixing bowls'],
  [/\bwhisk\b/i, 'Whisk'],
  [/\b(blender|food processor|immersion blender)\b/i, 'Blender or food processor'],
  [/\b(strain|strainer|sieve|colander)\b/i, 'Strainer'],
  [/\b(mortar|pestle)\b/i, 'Mortar and pestle'],
  [/\b(thermometer|internal temperature|reads? \d{2,3}\s?°?\s?[fc])\b/i, 'Thermometer'],
  [/\b(oven|preheat|broil)\b/i, 'Oven'],
];

/** Equipment the steps mention, in the order they first appear. */
export function equipmentFromSteps(steps: Pick<RecipeStep, 'instruction' | 'title'>[]): string[] {
  const found: string[] = [];
  for (const step of steps) {
    const text = `${step.title ?? ''} ${step.instruction}`;
    for (const [pattern, name] of EQUIPMENT) if (pattern.test(text) && !found.includes(name)) found.push(name);
  }
  return found;
}

const OVEN_OFF = /\b(turn (off|the oven off)|oven off|remove (it |them |the \w+ )?from the oven|take (it |them |the \w+ )?out of the oven)\b/i;

const BAKING = /\b(roast|roasting|bake|baking|broil|oven)\b/i;

/**
 * The oven temperature still in effect at a step, carried forward from the step that set it. It stops when a step
 * turns the oven off, or once the cooking step (a roast or bake with a timer) is behind you and this step is about
 * something else.
 */
export function ovenTemperature(steps: Pick<RecipeStep, 'temperature' | 'instruction' | 'timerSeconds'>[], index: number): string | null {
  const here = steps[index];
  if (!here) return null;
  const cookedSince = [...steps.slice(0, index + 1)].reverse().findIndex((s) => s.timerSeconds && s.timerSeconds > 0 && /\b(roast|roasting|bake|baking|broil)\b/i.test(s.instruction));
  if (cookedSince > 0 && !BAKING.test(here.instruction)) return null;
  for (let i = index; i >= 0; i -= 1) {
    const step = steps[i];
    if (i < index && OVEN_OFF.test(step.instruction)) return null;
    if (step.temperature && /oven|bake|roast|broil|preheat/i.test(`${step.instruction} ${step.temperature}`)) return step.temperature;
  }
  return null;
}

export interface Portion {
  /** 0.5 for "half the thyme"; null for "the rest of the thyme". */
  fraction: number | null;
  word: 'half' | 'quarter' | 'third' | 'rest';
}

const FRACTIONS: Record<string, Portion> = {
  half: { fraction: 0.5, word: 'half' },
  quarter: { fraction: 0.25, word: 'quarter' },
  third: { fraction: 1 / 3, word: 'third' },
  rest: { fraction: null, word: 'rest' },
  remaining: { fraction: null, word: 'rest' },
};

/**
 * When a step uses only part of an ingredient ("half the thyme", "the rest of the butter"), say how much, so the
 * screen does not show the whole amount. Looks for the ingredient's name within a few words after the portion word.
 */
export function portionUsed(instruction: string, ingredient: Pick<Ingredient, 'name'>): Portion | null {
  const raw = words(instruction);
  const tokens = raw.map(stem);
  const nameWords = words(ingredient.name).map(stem).filter((w) => w.length >= 3);
  if (nameWords.length === 0) return null;
  for (let i = 0; i < raw.length; i += 1) {
    // "rest" only counts as "the rest of", never "let the chicken rest"; "halves"/"halved" are not "half".
    const portion = raw[i] === 'rest' ? (raw[i + 1] === 'of' ? FRACTIONS.rest : undefined) : FRACTIONS[raw[i]];
    if (!portion) continue;
    const window = tokens.slice(i + 1, i + 6);
    if (nameWords.some((w) => window.includes(w))) return portion;
  }
  return null;
}

/**
 * General food-safety reminders triggered by what a step mentions. These are common kitchen guidance, not part of the
 * recipe, and the screen labels them that way.
 */
export function safetyNotes(step: Pick<RecipeStep, 'instruction' | 'title' | 'temperature'>, ingredients: Pick<Ingredient, 'name'>[] = []): string[] {
  const text = `${step.title ?? ''} ${step.instruction} ${ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  const notes: string[] = [];
  if (/\b(chicken|turkey|poultry|duck)\b/.test(text)) {
    notes.push('Poultry is safe at 165°F (74°C) in the thickest part. Wash your hands and anything the raw meat touched.');
  }
  if (/\b(ground (beef|pork|turkey|chicken)|burger|sausage)\b/.test(text)) {
    notes.push('Ground meat is safe at 160°F (71°C), 165°F (74°C) for poultry.');
  }
  if (/(room temperature|counter|sit out|come to room)/.test(text) && /\b(chicken|turkey|beef|pork|steak|fish|meat|roast)\b/.test(text)) {
    notes.push('Raw meat is fine at room temperature for up to 2 hours (1 hour if your kitchen is hot).');
  }
  if (/(dutch oven|from the oven|out of the oven|hot (pot|pan|skillet|dish|tray|sheet)|into the hot|preheated)/.test(text) || /^(4[0-9]{2}|5[0-9]{2})/.test((step.temperature ?? '').replace(/\D/g, ''))) {
    notes.push('Pots and pans from the oven are very hot. Use oven mitts, and treat the lid as hot too.');
  }
  return notes;
}
