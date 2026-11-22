import React, { useEffect, useState } from 'react';
import { ChefHat, Timer, X } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import { clearCookingSession, isLiveSession, saveCookingSession, secondsLeftOf, useCookingSessions } from '../utils/cookingSession.ts';
import { formatClock, stepLabel } from '../utils/cookingGuide.ts';
import { sounds } from '../utils/sound.ts';

interface CookingStripProps {
  recipes: Recipe[];
  onResume: (recipe: Recipe, servings?: number, unitSystem?: 'imperial' | 'metric') => void;
}

/*
 * "You are here" for a cook in progress, shown above the tab bar while cooking mode is closed.
 * It also rings any timer that finishes while you are elsewhere in the app, then turns red and
 * stays until you go back to the cook or stop it.
 */
export const CookingStrip: React.FC<CookingStripProps> = ({ recipes, onResume }) => {
  const sessions = useCookingSessions();
  const [now, setNow] = useState(() => Date.now());

  const anyRunning = sessions.some((s) => Object.values(s.timers).some((t) => t.endsAt !== null));
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  // A timer reached zero while cooking mode was closed: stop it, remember which step, and ring.
  useEffect(() => {
    let rang = false;
    for (const session of sessions) {
      const done = Object.entries(session.timers).filter(([, t]) => t.endsAt !== null && t.endsAt <= now);
      if (done.length === 0) continue;
      const timers = { ...session.timers };
      done.forEach(([key]) => (timers[key] = { ...timers[key], remaining: 0, endsAt: null }));
      saveCookingSession({ ...session, timers, alertStep: Number(done[0][0]) });
      rang = true;
    }
    if (!rang) return;
    sounds.playTimerComplete();
    try {
      navigator.vibrate?.([200, 100, 200, 100, 400]);
    } catch {}
  }, [now, sessions]);

  const live = sessions
    .map((session) => ({ session, recipe: recipes.find((r) => r.id === session.recipeId) }))
    .find(({ session, recipe }) => recipe && isLiveSession(session, now));
  if (!live || !live.recipe) return null;
  const { session, recipe } = live;

  const stepCount = recipe.steps.length;
  const stepNumber = Math.min(session.currentStepIndex, stepCount - 1) + 1;
  const running = Object.entries(session.timers)
    .filter(([, t]) => t.endsAt !== null)
    .map(([key, t]) => ({ step: Number(key), left: secondsLeftOf(t, now) }))
    .sort((a, b) => a.left - b.left);
  const soonest = running[0];
  const doneStep = session.alertStep != null ? recipe.steps[session.alertStep] : undefined;
  const state = doneStep ? 'done' : soonest && soonest.left < 60 ? 'soon' : 'calm';

  const tone =
    state === 'done'
      ? 'bg-red-700 text-white'
      : state === 'soon'
      ? 'bg-amber-500 text-on-accent'
      : 'bg-ink text-white';

  const label = doneStep ? `Timer done · ${stepLabel(doneStep)}` : `Cooking · Step ${stepNumber} of ${stepCount}`;
  const timerText = !doneStep && soonest ? formatClock(soonest.left) : null;

  return (
    <>
    {/* Room at the end of the page, so the strip never covers the last thing on it. */}
    <div aria-hidden="true" className="h-[4.5rem] shrink-0" />
    <div className="fixed inset-x-0 z-40 px-3 flex justify-center pointer-events-none bottom-[calc(4.25rem+max(0.25rem,env(safe-area-inset-bottom)))] xl:bottom-[max(1rem,env(safe-area-inset-bottom))]">
      <div className={`pointer-events-auto w-full max-w-lg rounded-2xl shadow-lg shadow-black/20 flex items-center gap-1 p-1.5 ${tone}`}>
        <button
          type="button"
          onClick={() => onResume(recipe, session.servings, session.unitSystem)}
          className="flex-1 min-w-0 min-h-12 flex items-center gap-3 rounded-xl px-2 text-left"
          aria-label={`Back to cooking ${recipe.title}, step ${stepNumber} of ${stepCount}${doneStep ? `. Timer done: ${stepLabel(doneStep)}` : timerText ? `. Timer: ${timerText}` : ''}`}
        >
          <ChefHat className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 flex flex-col leading-tight">
            <span role={doneStep ? 'alert' : undefined} className={`text-xs font-semibold uppercase tracking-wider truncate ${doneStep ? '' : 'opacity-80'}`}>
              {label}
            </span>
            <span className="text-sm font-semibold truncate">{recipe.title}</span>
          </span>
          {timerText && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums bg-black/15">
              <Timer className="w-4 h-4 shrink-0" aria-hidden="true" />
              {timerText}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => clearCookingSession(recipe.id)}
          className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl hover:bg-white/10"
          aria-label={`Stop cooking ${recipe.title}`}
          title="Stop cooking"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
    </>
  );
};
