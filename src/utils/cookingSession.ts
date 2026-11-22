import { useEffect, useState } from 'react';
import { UnitSystem } from './units.ts';

/*
 * A cook in progress, saved on this device so it outlives the cooking screen. Cooking mode writes it;
 * the app shell reads it to show the "Cooking" strip and to ring timers that finish while you are
 * somewhere else in the app.
 */

/** One timer per step that has one. It keeps running when you move to another step. */
export interface StepTimer {
  duration: number;
  /** Seconds left while paused. */
  remaining: number;
  /** When it will finish (ms since epoch) while running, otherwise null. Wall-clock, so a locked phone loses nothing. */
  endsAt: number | null;
}

export interface StoredCookingSession {
  recipeId: string;
  currentStepIndex: number;
  timers: Record<string, StepTimer>;
  updatedAt: string;
  servings?: number;
  unitSystem?: UnitSystem;
  /** A step whose timer finished while the cooking screen was closed. Cooking mode shows it on return. */
  alertStep?: number | null;
}

const KEY_PREFIX = 'heirloom_cooking_session_';
const CHANGE_EVENT = 'heirloom:cooking-session';

/** A cook untouched for this long, with no timer running, stops showing the strip. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export const getCookingSessionStorageKey = (recipeId: string) => `${KEY_PREFIX}${recipeId}`;

export const secondsLeftOf = (timer: StepTimer, at: number): number =>
  timer.endsAt !== null ? Math.max(0, Math.ceil((timer.endsAt - at) / 1000)) : timer.remaining;

const parseTimers = (raw: unknown): Record<string, StepTimer> => {
  const timers: Record<string, StepTimer> = {};
  if (raw && typeof raw === 'object') {
    for (const [key, t] of Object.entries(raw as Record<string, Partial<StepTimer>>)) {
      if (t && typeof t.duration === 'number' && t.duration > 0 && typeof t.remaining === 'number') {
        timers[key] = { duration: t.duration, remaining: Math.max(0, t.remaining), endsAt: typeof t.endsAt === 'number' ? t.endsAt : null };
      }
    }
  }
  return timers;
};

export const readStoredCookingSession = (recipeId: string, totalSteps: number): StoredCookingSession | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getCookingSessionStorageKey(recipeId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredCookingSession> & { timerSecondsLeft?: number | null; isTimerRunning?: boolean; initialTimerDuration?: number | null };
    if (parsed.recipeId !== recipeId || typeof parsed.currentStepIndex !== 'number') {
      return null;
    }

    const currentStepIndex = Math.max(0, Math.min(totalSteps - 1, parsed.currentStepIndex));
    let timers: Record<string, StepTimer> = {};
    if (parsed.timers && typeof parsed.timers === 'object') {
      timers = parseTimers(parsed.timers);
    } else if (typeof parsed.timerSecondsLeft === 'number' && parsed.timerSecondsLeft >= 0) {
      // A session saved before timers outlived steps: one timer, on the step you were on.
      const duration = typeof parsed.initialTimerDuration === 'number' && parsed.initialTimerDuration > 0 ? parsed.initialTimerDuration : parsed.timerSecondsLeft;
      if (duration > 0) {
        timers[String(currentStepIndex)] = {
          duration,
          remaining: parsed.timerSecondsLeft,
          endsAt: parsed.isTimerRunning && parsed.timerSecondsLeft > 0 ? Date.now() + parsed.timerSecondsLeft * 1000 : null,
        };
      }
    }

    return {
      recipeId,
      currentStepIndex,
      timers,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      servings: typeof parsed.servings === 'number' && parsed.servings > 0 ? parsed.servings : undefined,
      unitSystem: parsed.unitSystem === 'metric' || parsed.unitSystem === 'imperial' ? parsed.unitSystem : undefined,
      alertStep: typeof parsed.alertStep === 'number' ? parsed.alertStep : null,
    };
  } catch {
    return null;
  }
};

const announce = () => window.dispatchEvent(new Event(CHANGE_EVENT));

export function saveCookingSession(session: StoredCookingSession) {
  try {
    window.localStorage.setItem(getCookingSessionStorageKey(session.recipeId), JSON.stringify(session));
  } catch {
    // Storage unavailable (private mode): the cook just isn't remembered.
  }
  announce();
}

export function clearCookingSession(recipeId: string) {
  try {
    window.localStorage.removeItem(getCookingSessionStorageKey(recipeId));
  } catch {}
  announce();
}

/** Every saved cook on this device, newest first. */
export function listCookingSessions(): StoredCookingSession[] {
  const out: StoredCookingSession[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const session = readStoredCookingSession(key.slice(KEY_PREFIX.length), Number.MAX_SAFE_INTEGER);
      if (session) out.push(session);
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** True while a cook should still show in the strip: recent, or with a timer running or just finished. */
export const isLiveSession = (session: StoredCookingSession, at: number) =>
  Object.values(session.timers).some((t) => t.endsAt !== null) ||
  session.alertStep != null ||
  at - Date.parse(session.updatedAt) < STALE_AFTER_MS;

/** The saved cooks, re-read whenever cooking mode (or another tab) changes one. */
export function useCookingSessions(): StoredCookingSession[] {
  const [sessions, setSessions] = useState<StoredCookingSession[]>(() => (typeof window === 'undefined' ? [] : listCookingSessions()));
  useEffect(() => {
    const refresh = () => setSessions(listCookingSessions());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith(KEY_PREFIX)) refresh();
    };
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return sessions;
}
