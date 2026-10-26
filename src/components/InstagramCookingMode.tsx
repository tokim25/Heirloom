import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Flame,
  Lightbulb,
  Volume2,
  VolumeX,
  Sparkles,
  Mic,
  MicOff,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { CookingFinish } from './CookingFinish.tsx';
import { CookingPrep } from './CookingPrep.tsx';
import { formatClock, formatDurationWords, nextUp, ovenTemperature, portionUsed, safetyNotes, stepLabel } from '../utils/cookingGuide.ts';
import { Recipe } from '../types/recipe.ts';
import { scaleQuantity, formatFraction, convertUnit, formatStepTemperatures, UnitSystem } from '../utils/units.ts';
import { ingredientsForStep } from '../utils/stepIngredients.ts';
import { sounds } from '../utils/sound.ts';

interface InstagramCookingModeProps {
  recipe: Recipe;
  servings: number;
  unitSystem: UnitSystem;
  onClose: () => void;
  /** Called with a note for next time when the person writes one at the end. */
  onFinished?: (note: string) => void;
  onAddStepIngredientsToGroceries?: (stepIngredients: string[]) => void;
}

/** One timer per step that has one. It keeps running when you move to another step. */
interface StepTimer {
  duration: number;
  /** Seconds left while paused. */
  remaining: number;
  /** When it will finish (ms since epoch) while running, otherwise null. Wall-clock, so a locked phone loses nothing. */
  endsAt: number | null;
}

interface StoredCookingSession {
  recipeId: string;
  currentStepIndex: number;
  timers: Record<string, StepTimer>;
  updatedAt: string;
}

const getCookingSessionStorageKey = (recipeId: string) => `heirloom_cooking_session_${recipeId}`;

const readStoredCookingSession = (
  storageKey: string,
  recipeId: string,
  totalSteps: number
): StoredCookingSession | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredCookingSession> & { timerSecondsLeft?: number | null; isTimerRunning?: boolean; initialTimerDuration?: number | null };
    if (parsed.recipeId !== recipeId || typeof parsed.currentStepIndex !== 'number') {
      return null;
    }

    const currentStepIndex = Math.max(0, Math.min(totalSteps - 1, parsed.currentStepIndex));
    const timers: Record<string, StepTimer> = {};
    if (parsed.timers && typeof parsed.timers === 'object') {
      for (const [key, t] of Object.entries(parsed.timers)) {
        if (t && typeof t.duration === 'number' && t.duration > 0 && typeof t.remaining === 'number') {
          timers[key] = { duration: t.duration, remaining: Math.max(0, t.remaining), endsAt: typeof t.endsAt === 'number' ? t.endsAt : null };
        }
      }
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

    return { recipeId, currentStepIndex, timers, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString() };
  } catch {
    return null;
  }
};

const secondsLeftOf = (timer: StepTimer, at: number): number =>
  timer.endsAt !== null ? Math.max(0, Math.ceil((timer.endsAt - at) / 1000)) : timer.remaining;

const COOKING_HINT_KEY = 'heirloom_cooking_hint_seen';

export const InstagramCookingMode: React.FC<InstagramCookingModeProps> = ({
  recipe,
  servings,
  unitSystem,
  onClose,
  onFinished,
}) => {
  const totalSteps = recipe.steps.length;
  const cookingSessionStorageKey = getCookingSessionStorageKey(recipe.id);
  const restoredSessionRef = useRef<StoredCookingSession | null>(
    readStoredCookingSession(cookingSessionStorageKey, recipe.id, totalSteps)
  );
  const [hasRestoredSession] = useState(() => restoredSessionRef.current !== null);

  const [currentStepIndex, setCurrentStepIndex] = useState(
    () => restoredSessionRef.current?.currentStepIndex || 0
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [finished, setFinished] = useState(false);
  // A fresh start opens on "Before you start"; resuming goes straight back to where you were.
  const [showPrep, setShowPrep] = useState(() => restoredSessionRef.current === null);
  const startedAtRef = useRef(Date.now());
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedCommand, setRecognizedCommand] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);

  // Timers: one per step that has one, all of them keep counting whichever step is on screen.
  const [timers, setTimers] = useState<Record<number, StepTimer>>(() => {
    const out: Record<number, StepTimer> = {};
    recipe.steps.forEach((step, i) => {
      if (step.timerSeconds && step.timerSeconds > 0) out[i] = { duration: step.timerSeconds, remaining: step.timerSeconds, endsAt: null };
    });
    const saved = restoredSessionRef.current;
    if (saved) {
      for (const [key, t] of Object.entries(saved.timers)) {
        const i = Number(key);
        if (out[i]) out[i] = t;
      }
    }
    return out;
  });
  const [now, setNow] = useState(() => Date.now());
  const [timerAlert, setTimerAlert] = useState<number | null>(null);
  const anyTimerRunning = Object.values(timers).some((t) => t.endsAt !== null);
  const recognitionRef = useRef<any>(null);

  const [showHint, setShowHint] = useState(() => {
    try {
      return window.localStorage.getItem(COOKING_HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const currentStep = recipe.steps[currentStepIndex];
  const isLastStep = currentStepIndex === totalSteps - 1;

  // The timer for the step on screen, in the shape the rest of this screen already uses.
  const currentTimer: StepTimer | undefined = timers[currentStepIndex];
  const timerSecondsLeft: number | null = currentTimer ? secondsLeftOf(currentTimer, now) : null;
  const isTimerRunning = !!currentTimer && currentTimer.endsAt !== null;
  const initialTimerDuration: number | null = currentTimer?.duration ?? null;

  const updateCurrentTimer = (change: (timer: StepTimer, at: number) => StepTimer) =>
    setTimers((prev) => {
      const timer = prev[currentStepIndex];
      return timer ? { ...prev, [currentStepIndex]: change(timer, Date.now()) } : prev;
    });
  const setIsTimerRunning = (value: boolean | ((running: boolean) => boolean)) =>
    updateCurrentTimer((timer, at) => {
      const running = timer.endsAt !== null;
      const next = typeof value === 'function' ? value(running) : value;
      if (next === running) return timer;
      if (next) {
        const remaining = timer.remaining > 0 ? timer.remaining : timer.duration;
        return { ...timer, remaining, endsAt: at + remaining * 1000 };
      }
      return { ...timer, remaining: secondsLeftOf(timer, at), endsAt: null };
    });
  const setTimerSecondsLeft = (value: number | ((seconds: number | null) => number | null)) =>
    updateCurrentTimer((timer, at) => {
      const next = typeof value === 'function' ? value(secondsLeftOf(timer, at)) : value;
      if (next === null) return timer;
      return timer.endsAt !== null ? { ...timer, endsAt: at + next * 1000 } : { ...timer, remaining: next };
    });

  // Auto-save cooking progress so closing Stories mode does not lose place or running timers.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session: StoredCookingSession = {
      recipeId: recipe.id,
      currentStepIndex,
      timers: Object.fromEntries(Object.entries(timers).map(([k, t]) => [k, t])),
      updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(cookingSessionStorageKey, JSON.stringify(session));
    } catch {}
  }, [cookingSessionStorageKey, currentStepIndex, recipe.id, timers]);

  // Tick while anything is running; the display is computed from the clock, so a slow or paused page catches up.
  useEffect(() => {
    if (!anyTimerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [anyTimerRunning]);

  // When a timer reaches zero: stop it, and tell the person whichever step they are on.
  useEffect(() => {
    const done = Object.entries(timers).filter(([, t]) => t.endsAt !== null && t.endsAt <= now);
    if (done.length === 0) return;
    setTimers((prev) => {
      const next = { ...prev };
      done.forEach(([key]) => (next[Number(key)] = { ...prev[Number(key)], remaining: 0, endsAt: null }));
      return next;
    });
    const first = Number(done[0][0]);
    setTimerAlert(first);
    if (soundEnabled) sounds.playTimerComplete();
    try {
      navigator.vibrate?.([200, 100, 200, 100, 400]);
    } catch {}
    speakNotification(`Timer finished. ${stepLabel(recipe.steps[first])}.`);
  }, [now, timers]);

  // Speech Synthesis: Read step instructions aloud hands-free
  const speakCurrentStep = (stepIdx: number = currentStepIndex) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const targetStep = recipe.steps[stepIdx];
    if (!targetStep) return;

    const formattedInstruction = formatStepTemperatures(targetStep.instruction, unitSystem);
    const speechText = `Step ${stepIdx + 1}. ${targetStep.title || ''}. ${formattedInstruction}. ${
      targetStep.timerSeconds ? `Cook time is ${Math.ceil(targetStep.timerSeconds / 60)} minutes.` : ''
    } ${targetStep.tips ? `Chef note: ${targetStep.tips}` : ''}`;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 0.95; // warm, deliberate pacing
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const speakNotification = (text: string) => {
    if (!('speechSynthesis' in window) || !isVoiceActive) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const speakStepIngredients = () => {
    if (!('speechSynthesis' in window)) return;
    if (!currentStep.stepIngredients || currentStep.stepIngredients.length === 0) {
      speakNotification("No specific ingredients listed for this step.");
      return;
    }
    const ingredientListText = currentStep.stepIngredients.join(', ');
    speakNotification(`Ingredients for this step: ${ingredientListText}`);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleNextStep = () => {
    dismissHint();
    if (soundEnabled) sounds.playCheckTick();
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Completed all steps!
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(cookingSessionStorageKey);
      }
      setFinished(true);
      // Spoken only when the person already turned the voice guide on.
      speakNotification('Enjoy your meal.');
    }
  };

  const handlePrevStep = () => {
    dismissHint();
    if (currentStepIndex > 0) {
      if (soundEnabled) sounds.playCheckTick();
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Story navigation, like Instagram: tap the left third of the screen to go back and the rest to
  // go forward; swipe left/right to move and swipe up to close. Buttons, links and form fields keep
  // their own behavior, and text selection or scrolling a long step never navigates.
  const swipeStartRef = useRef<{ x: number; y: number; inScrollable: boolean } | null>(null);
  const ignoreTapUntilRef = useRef(0);

  const dismissHint = () => {
    setShowHint(false);
    try {
      window.localStorage.setItem(COOKING_HINT_KEY, '1');
    } catch {
      // Private mode: the hint just shows again next time.
    }
  };

  const handleStoryTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (finished || showPrep) return;
    if (Date.now() < ignoreTapUntilRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, label, summary, [data-no-tap]')) return;
    if (window.getSelection()?.toString()) return;
    dismissHint();
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) {
      handlePrevStep();
    } else if (!isLastStep) {
      // On the last step only the Finish button finishes, so a stray tap cannot fire the confetti.
      handleNextStep();
    }
  };

  // True when the touch began inside something that can still scroll vertically (a long step).
  const startsInScrollableArea = (target: EventTarget | null, root: HTMLElement) => {
    let node = target as HTMLElement | null;
    while (node && node !== root) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) return true;
      node = node.parentElement;
    }
    return false;
  };

  const handleStoryTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    swipeStartRef.current = touch
      ? { x: touch.clientX, y: touch.clientY, inScrollable: startsInScrollableArea(e.target, e.currentTarget) }
      : null;
  };

  const handleStoryTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (finished || showPrep) {
      swipeStartRef.current = null;
      return;
    }
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = e.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // Swipe up closes the cooking view (unless the finger was scrolling a long step).
    if (dy < -80 && Math.abs(dy) > Math.abs(dx) * 1.5 && !start.inScrollable) {
      ignoreTapUntilRef.current = Date.now() + 400;
      onClose();
      return;
    }
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    ignoreTapUntilRef.current = Date.now() + 400; // a swipe must not also count as a tap
    dismissHint();
    if (dx < 0) {
      if (!isLastStep) handleNextStep();
    } else {
      handlePrevStep();
    }
  };

  // Web Speech API: Speech Recognition for Hands-Free "Dirty Hands" Cooking
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setVoiceSupported(false);
      return;
    }

    if (!isVoiceActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
      setRecognizedCommand(transcript);
      setTimeout(() => setRecognizedCommand(null), 3500);

      // Voice Command Routing
      if (transcript.includes('next') || transcript.includes('forward') || transcript.includes('continue')) {
        sounds.playCheckTick();
        handleNextStep();
      } else if (transcript.includes('back') || transcript.includes('previous')) {
        sounds.playCheckTick();
        handlePrevStep();
      } else if (
        transcript.includes('repeat') ||
        transcript.includes('read again') ||
        transcript.includes('what do i do') ||
        transcript.includes('read step')
      ) {
        speakCurrentStep(currentStepIndex);
      } else if (
        transcript.includes('ingredient') ||
        transcript.includes('what ingredients') ||
        transcript.includes('read ingredients')
      ) {
        speakStepIngredients();
      } else if (
        transcript.includes('start timer') ||
        transcript.includes('run timer') ||
        transcript.includes('play timer')
      ) {
        setIsTimerRunning(true);
        sounds.playCheckTick();
        speakNotification('Timer started.');
      } else if (
        transcript.includes('stop timer') ||
        transcript.includes('pause timer')
      ) {
        setIsTimerRunning(false);
        sounds.playCheckTick();
        speakNotification('Timer paused.');
      } else if (
        transcript.includes('how much time') ||
        transcript.includes('time left') ||
        transcript.includes('timer status')
      ) {
        if (timerSecondsLeft !== null) {
          const m = Math.floor(timerSecondsLeft / 60);
          const s = timerSecondsLeft % 60;
          speakNotification(`${m > 0 ? `${m} minutes and ` : ''}${s} seconds remaining.`);
        } else {
          speakNotification('No active timer for this step.');
        }
      } else if (
        transcript.includes('close') ||
        transcript.includes('done cooking') ||
        transcript.includes('exit')
      ) {
        onClose();
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') {
        console.warn('Speech recognition warning:', e.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if hands-free dirty-hands mode is still enabled
      if (isVoiceActive) {
        try {
          recognition.start();
        } catch {}
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Recognition start error:', err);
    }

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [isVoiceActive, currentStepIndex, timerSecondsLeft]);

  // Read step aloud on step change if voice active
  useEffect(() => {
    if (isVoiceActive) {
      speakCurrentStep(currentStepIndex);
    } else {
      stopSpeaking();
    }
    return () => stopSpeaking();
  }, [currentStepIndex, isVoiceActive]);

  // Keyboard navigation (Arrow keys & Space for timer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (finished) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (showPrep) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'ArrowRight') handleNextStep();
      if (e.key === 'ArrowLeft') handlePrevStep();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' && timerSecondsLeft !== null) {
        e.preventDefault();
        setIsTimerRunning((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, timerSecondsLeft, finished, showPrep]);

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Get ingredients used specifically in this step
  const stepIngredientItems = ingredientsForStep(recipe.ingredients, currentStep);
  const ovenNow = currentStep.temperature ? null : ovenTemperature(recipe.steps, currentStepIndex);
  const safety = safetyNotes(currentStep, stepIngredientItems);
  const upNext = nextUp(recipe.steps, currentStepIndex);
  const [safetyOpen, setSafetyOpen] = useState(false);
  useEffect(() => setSafetyOpen(false), [currentStepIndex]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Cooking mode: ${recipe.title}`} onClick={handleStoryTap} onTouchStart={handleStoryTouchStart} onTouchEnd={handleStoryTouchEnd} data-story-surface className="stone-original fixed inset-0 z-[60] cursor-pointer bg-ink-deep/95 backdrop-blur-xl flex flex-col items-center justify-between text-stone-100 select-none overflow-hidden animate-in fade-in duration-200">
      {showPrep && <CookingPrep recipe={recipe} servings={servings} unitSystem={unitSystem} onStart={() => setShowPrep(false)} onClose={onClose} />}

      {finished && (
        <CookingFinish
          title={recipe.title}
          minutes={hasRestoredSession ? null : Math.round((Date.now() - startedAtRef.current) / 60000)}
          onBack={() => setFinished(false)}
          onDone={(note) => {
            if (note) onFinished?.(note);
            onClose();
          }}
        />
      )}

      {/* Background Ambient Glow */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-3xl scale-110 pointer-events-none"
        style={{ backgroundImage: `url(${recipe.heroImage})` }}
      />

      {/* Top Header & Instagram Story Progress Bars */}
      <div className="w-full max-w-2xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 z-20 flex flex-col gap-5">
        {/* Progress Segments */}
        <div className="flex items-center gap-1.5 w-full">
          {recipe.steps.map((_, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                aria-label={`Go to step ${idx + 1} of ${totalSteps}`}
                aria-current={isCurrent ? 'step' : undefined}
                className="group flex-1 py-5 -my-5 cursor-pointer"
              >
                <span className="block h-1 rounded-full bg-white/20 overflow-hidden transition-all group-hover:h-1.5">
                  <span
                    className={`block h-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-amber-400 w-full'
                        : isCurrent
                        ? 'bg-white w-full shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                        : 'w-0'
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {timerAlert !== null && (
          <div role="alert" className="rounded-2xl bg-emerald-500 text-on-accent px-4 py-3 flex items-center gap-3">
            <span className="flex-1 min-w-0 text-base font-semibold">Timer finished: {stepLabel(recipe.steps[timerAlert])}</span>
            {timerAlert !== currentStepIndex && (
              <button
                type="button"
                onClick={() => {
                  setCurrentStepIndex(timerAlert);
                  setTimerAlert(null);
                }}
                className="min-h-11 px-3 rounded-xl bg-black/15 text-sm font-semibold"
              >
                Go to step
              </button>
            )}
            <button type="button" onClick={() => setTimerAlert(null)} className="min-h-11 px-3 rounded-xl bg-black/15 text-sm font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {Object.entries(timers).some(([k, t]) => Number(k) !== currentStepIndex && t.endsAt !== null) && (
          <div className="flex flex-wrap gap-2" aria-label="Timers running on other steps">
            {Object.entries(timers)
              .filter(([k, t]) => Number(k) !== currentStepIndex && t.endsAt !== null)
              .map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCurrentStepIndex(Number(k))}
                  className="min-h-11 px-4 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-100 text-sm font-semibold inline-flex items-center gap-2"
                >
                  <span className="truncate max-w-[9rem]">{stepLabel(recipe.steps[Number(k)])}</span>
                  <span className="tabular-nums">{formatClock(secondsLeftOf(t, now))}</span>
                </button>
              ))}
          </div>
        )}

        {showHint && (
          <p role="status" className="self-center rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 text-center">
            Tap the right side for next, the left for back. Swipe up to close.
          </p>
        )}

        {/* Top Controls Bar */}
        <div className="flex items-center justify-between text-white/90">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
              title="Close Cooking Mode"
              aria-label="Close cooking mode"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-wider uppercase text-amber-300">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              <span className="text-sm text-white/80 font-serif italic truncate max-w-[120px] xs:max-w-[180px] sm:max-w-md">
                {recipe.title}
              </span>
              {hasRestoredSession && (
                <span className="mt-1 text-xs text-emerald-200 font-semibold">
                  Resumed saved session
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Hands-Free Kitchen Voice Guide */}
            <button
              onClick={() => {
                if (!voiceSupported) return;
                if (isVoiceActive) {
                  setIsVoiceActive(false);
                  stopSpeaking();
                } else {
                  setIsVoiceActive(true);
                  speakCurrentStep(currentStepIndex);
                }
              }}
              disabled={!voiceSupported}
              className={`flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-medium transition-all ${
                !voiceSupported
                  ? 'bg-white/5 text-white/35 cursor-not-allowed'
                  : isVoiceActive
                  ? 'bg-amber-400 text-on-accent font-semibold shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                  : 'bg-white/10 hover:bg-white/20 text-white/90'
              }`}
              title={
                !voiceSupported
                  ? 'Voice commands are not supported in this browser'
                  : isVoiceActive
                  ? 'Disable Voice Guide'
                  : 'Enable Hands-Free Kitchen Voice Guide'
              }
            >
              {isVoiceActive ? (
                <>
                  <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-pulse text-stone-950' : ''}`} />
                  <span>{isSpeaking ? 'Speaking...' : 'Voice On'}</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-stone-400" />
                  <span className="hidden sm:inline">{voiceSupported ? 'Voice Guide' : 'Voice Unavailable'}</span>
                </>
              )}
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-all"
              aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
              title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
            </button>
            <div className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium tracking-wide">
              {servings} {servings === 1 ? 'serving' : 'servings'}
            </div>
          </div>
        </div>

        {!voiceSupported && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
            <MicOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Voice commands are not available in this browser. You can still use read mode controls, timers, arrow keys, and the buttons below.</span>
          </div>
        )}
      </div>

      {/* Main Story Content Card. Long steps scroll inside this area. */}
      <div className="flex-1 min-h-0 w-full flex justify-center overflow-y-auto overscroll-contain z-10">
      <div className="relative w-full max-w-2xl px-4 py-2 my-auto">
        {/* The Card */}
        <div className="w-full bg-ink/80 border border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl flex flex-col gap-6 relative z-20">
          {/* Step title (only when the recipe gave one) and the heat */}
          {(currentStep.title || currentStep.temperature || ovenNow) && (
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              {currentStep.title ? <h2 className="text-2xl sm:text-3xl font-serif tracking-tight text-white">{currentStep.title}</h2> : <span />}
              {(currentStep.temperature || ovenNow) && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 text-base font-semibold shrink-0">
                  <Flame className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span>{currentStep.temperature || `Oven ${ovenNow}`}</span>
                </div>
              )}
            </div>
          )}

          {/* Step Instruction Text */}
          <p className="text-2xl sm:text-3xl text-stone-50 leading-snug font-normal">
            {formatStepTemperatures(currentStep.instruction, unitSystem)}
          </p>

          {currentStep.lookFor && (
            <p className="text-xl text-emerald-200 leading-snug">
              <span className="font-semibold">Look for: </span>
              {currentStep.lookFor}
            </p>
          )}

          {/* The timer: big enough to read from across the kitchen. It keeps running when you move to another step. */}
          {timerSecondsLeft !== null && (
            <div className="bg-ink-deep/45 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-inner" aria-live="off">
              <div className="flex flex-col gap-1.5">
                <div
                  className={`font-mono font-bold tabular-nums leading-none ${(initialTimerDuration ?? 0) >= 3600 ? 'text-4xl sm:text-6xl' : 'text-5xl sm:text-6xl'} ${
                    timerSecondsLeft === 0 ? 'text-emerald-300' : isTimerRunning ? 'text-white' : 'text-white/70'
                  }`}
                  role="timer"
                  aria-label={`${formatDurationWords(timerSecondsLeft)} left`}
                >
                  {formatClock(timerSecondsLeft)}
                </div>
                <p className="text-base text-stone-300">
                  {timerSecondsLeft === 0
                    ? 'Finished'
                    : isTimerRunning
                    ? `of ${formatDurationWords(initialTimerDuration ?? 0)}, running`
                    : `${formatDurationWords(initialTimerDuration ?? 0)} timer`}
                </p>
              </div>

              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full transition-all duration-500 ${timerSecondsLeft === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${initialTimerDuration ? (1 - timerSecondsLeft / initialTimerDuration) * 100 : 0}%` }}
                />
              </div>

              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`flex items-center justify-center gap-2 min-h-14 px-3 rounded-xl font-semibold text-lg whitespace-nowrap shadow-md transition-all ${
                    isTimerRunning ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-amber-500 hover:bg-amber-400 text-on-accent'
                  }`}
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="w-5 h-5" /> Pause
                    </>
                  ) : timerSecondsLeft === 0 ? (
                    <>
                      <RotateCcw className="w-5 h-5" /> Run it again
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" /> Start timer
                    </>
                  )}
                </button>

                <button
                  onClick={() => setTimerSecondsLeft((prev) => (prev ? prev + 60 : 60))}
                  className="min-h-14 min-w-14 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-base font-semibold"
                  title="Add 1 minute"
                  aria-label="Add one minute"
                >
                  +1m
                </button>

                <button
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSecondsLeft(initialTimerDuration || 0);
                  }}
                  className="min-h-14 min-w-14 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 flex items-center justify-center"
                  title="Reset timer"
                  aria-label="Reset timer"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Ingredients for this step, with how much of each this step uses */}
          {stepIngredientItems.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-sm text-white/60 font-medium">For this step</span>
              <div className="flex flex-col gap-2">
                {stepIngredientItems.map((ing) => {
                  const portion = portionUsed(currentStep.instruction, ing);
                  const scaledAmount = scaleQuantity(ing.amount, recipe.defaultServings, servings);
                  const usedAmount = portion?.fraction ? (scaledAmount === null ? null : scaledAmount * portion.fraction) : scaledAmount;
                  const converted = convertUnit(usedAmount, ing.unit, ing.name, unitSystem);
                  const formattedFraction = formatFraction(converted.amount);
                  const quantity = portion?.word === 'rest' ? 'the rest of' : formattedFraction ? `${formattedFraction} ${converted.unit}` : converted.unit;
                  return (
                    <div key={ing.id} className="flex items-baseline gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-base text-stone-100">
                      <span className="font-semibold text-amber-300 shrink-0">{quantity}</span>
                      <span>
                        {ing.name}
                        {ing.notes ? <span className="text-stone-400">, {ing.notes}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chef's Pro-Tip */}
          {currentStep.tips && (
            <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-100 text-base leading-relaxed">
              <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 mr-1">Chef’s Note:</span>
                {currentStep.tips}
              </div>
            </div>
          )}

          {/* General food-safety reminders, folded away unless asked for, and labelled as not part of the recipe */}
          {safety.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => setSafetyOpen((open) => !open)}
                aria-expanded={safetyOpen}
                className="w-full min-h-12 px-4 flex items-center gap-2 text-left text-base text-stone-200"
              >
                <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
                <span className="flex-1">Safety reminder</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${safetyOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {safetyOpen && (
                <div className="px-4 pb-4 flex flex-col gap-2 text-base text-stone-200">
                  {safety.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  <p className="text-sm text-stone-400">General kitchen guidance, not from this recipe.</p>
                </div>
              )}
            </div>
          )}

          {/* What comes next, especially useful while a timer runs */}
          {upNext && (
            <p className="text-base text-stone-400 border-t border-white/10 pt-4">
              <span className="font-semibold text-stone-300">{timerSecondsLeft !== null ? 'While you wait, next up: ' : 'Next: '}</span>
              {upNext}
            </p>
          )}
        </div>
      </div>
      </div>

      {/* Hands-Free Dirty-Hands Voice Assistant Floating HUD */}
      {isVoiceActive && (
        <div className="w-full max-w-2xl px-4 z-30 flex flex-col items-center gap-1.5 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-ink/90 border border-amber-500/40 shadow-xl backdrop-blur-xl text-xs text-stone-200">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75" />
              <Mic className="w-4 h-4 text-amber-400 relative z-10" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-400 text-xs uppercase tracking-wider">
                Hands-Free Active:
              </span>
              {recognizedCommand ? (
                <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-on-accent font-bold text-xs shadow-xs">
                  Heard: "{recognizedCommand}"
                </span>
              ) : isSpeaking ? (
                <span className="text-xs text-amber-200 animate-pulse font-medium">
                  Speaking instruction...
                </span>
              ) : (
                <span className="text-xs text-stone-300">
                  Listening for: <span className="text-white font-medium">"Next"</span>, <span className="text-white font-medium">"Back"</span>, <span className="text-white font-medium">"Repeat"</span>, <span className="text-white font-medium">"Ingredients"</span>, <span className="text-white font-medium">"Timer"</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Navigation Controls */}
      <div className="w-full max-w-2xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-4">
        <button
          onClick={handlePrevStep}
          disabled={currentStepIndex === 0}
          aria-label="Previous step"
          className={`flex items-center gap-1.5 min-h-12 px-5 rounded-xl text-sm font-medium backdrop-blur-md transition-all ${
            currentStepIndex === 0
              ? 'opacity-30 cursor-not-allowed text-white/40'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <span className="text-xs text-white/60 font-medium hidden sm:inline">
          Tap the sides, swipe, or use arrow keys. Swipe up to close.
        </span>

        <button
          onClick={handleNextStep}
          className="flex items-center gap-2 min-h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-on-accent text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
        >
          {isLastStep ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Finish Recipe!</span>
            </>
          ) : (
            <>
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
