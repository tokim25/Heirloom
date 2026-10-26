import React from 'react';
import { Clock, X } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import { convertUnit, formatFraction, scaleQuantity, UnitSystem } from '../utils/units.ts';
import { equipmentFromSteps, formatDurationWords, totalWaitSeconds } from '../utils/cookingGuide.ts';

interface CookingPrepProps {
  recipe: Recipe;
  servings: number;
  unitSystem: UnitSystem;
  onStart: () => void;
  onClose: () => void;
}

/**
 * "Before you start": how long the whole thing takes, what to have out, and anything with a long wait, so the first
 * step is never a surprise. Everything here is read from the recipe itself.
 */
export const CookingPrep: React.FC<CookingPrepProps> = ({ recipe, servings, unitSystem, onStart, onClose }) => {
  const wait = totalWaitSeconds(recipe.steps);
  const longWaits = recipe.steps
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => (step.timerSeconds ?? 0) >= 3600)
    .map(({ step, i }) => `Step ${i + 1}: ${formatDurationWords(step.timerSeconds!)}`);
  const equipment = equipmentFromSteps(recipe.steps);

  return (
    <div role="group" aria-label="Before you start" className="absolute inset-0 z-30 bg-ink-deep text-stone-100 flex flex-col">
      <div className="flex items-center justify-between px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs font-semibold tracking-widest uppercase text-amber-300">Before you start</p>
        <button type="button" onClick={onClose} aria-label="Close cooking mode" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 pt-2 max-w-2xl w-full mx-auto flex flex-col gap-6">
        <h2 className="font-serif text-3xl leading-tight">{recipe.title}</h2>

        {(recipe.totalTimeMinutes > 0 || wait > 0) && (
          <div className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3">
            <Clock className="w-5 h-5 mt-0.5 text-amber-300 shrink-0" aria-hidden="true" />
            <div className="text-base">
              {recipe.totalTimeMinutes > 0 && <p className="font-semibold">About {formatDurationWords(recipe.totalTimeMinutes * 60)} in all</p>}
              {wait > 0 && (
                <p className="text-stone-300">
                  {recipe.totalTimeMinutes > 0 && wait <= recipe.totalTimeMinutes * 60 ? `${formatDurationWords(wait)} of that is timers and waiting` : `Timers add up to ${formatDurationWords(wait)}`}
                </p>
              )}
              {longWaits.length > 0 && <p className="text-amber-200 mt-1">Plan around the long wait: {longWaits.join(', ')}</p>}
            </div>
          </div>
        )}

        {equipment.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-stone-300">Have ready</h3>
            <ul className="flex flex-wrap gap-2">
              {equipment.map((item) => (
                <li key={item} className="px-3 py-1.5 rounded-full bg-white/10 text-sm">{item}</li>
              ))}
            </ul>
            <p className="text-xs text-stone-400">Picked out of the steps.</p>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-stone-300">Ingredients for {servings} {servings === 1 ? 'serving' : 'servings'}</h3>
          <ul className="flex flex-col divide-y divide-white/10 rounded-2xl bg-white/5">
            {recipe.ingredients.map((ing) => {
              const scaled = scaleQuantity(ing.amount, recipe.defaultServings, servings);
              const converted = convertUnit(scaled, ing.unit, ing.name, unitSystem);
              const amount = formatFraction(converted.amount);
              return (
                <li key={ing.id} className="px-4 py-2.5 flex items-baseline gap-3 text-base">
                  <span className="w-24 shrink-0 font-semibold text-amber-300">{amount ? `${amount} ${converted.unit}` : converted.unit}</span>
                  <span>
                    {ing.name}
                    {ing.notes ? <span className="text-stone-400">, {ing.notes}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-2xl w-full mx-auto">
        <button type="button" onClick={onStart} className="w-full min-h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-on-accent text-lg font-semibold">
          Start cooking
        </button>
      </div>
    </div>
  );
};
