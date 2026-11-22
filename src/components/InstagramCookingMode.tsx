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
import { StepTimer, StoredCookingSession, clearCookingSession, readStoredCookingSession, saveCookingSession, secondsLeftOf } from '../utils/cookingSession.ts';

interface InstagramCookingModeProps {
  recipe: Recipe;
  servings: number;
  unitSystem: UnitSystem;
  onClose: () => void;
  /** Called with a note for next time when the person writes one at the end. */
  onFinished?: (note: string) => void;
  onAddStepIngredientsToGroceries?: (stepIngredients: string[]) => void;
}

const COOKING_HINT_KEY = 'heirloom_cooking_hint_seen';

export const InstagramCookingMode: React.FC<InstagramCookingModeProps> = ({
  recipe,
  servings,
  unitSystem,
  onClose,
  onFinished,
}) => {
  const totalSteps = recipe.steps.length;
  const restoredSessionRef = useRef<StoredCookingSession | null>(readStoredCookingSession(recipe.id, totalSteps));
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
  // A timer that finished while this screen was closed is shown again on return.
  const [timerAlert, setTimerAlert] = useState<number | null>(() => restoredSessionRef.current?.alertStep ?? null);
  const anyTimerRunning = Object.values(timers).some((t) => t.endsAt !== null);
  const recognitionRef = useRef<any>(null);

  const [showHint, setShowHint] = useState(() => {
    try {
      return window.localStorage.getItem(COOKING_HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });

  // Leaving with timers running asks first. The timers keep going either way: the app shell rings them.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const runningTimerCount = Object.values(timers).filter((t) => t.endsAt !== null).length;
  const requestClose = () => {
    if (runningTimerCount > 0 && !finished && !showPrep) setConfirmLeave(true);
    else onClose();
  };

  // Keep the screen on while cooking, so the phone doesn't lock on the counter. The browser drops the
  // lock whenever the page is hidden, so it is asked for again each time the page comes back.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen').then(
        (l) => {
          if (cancelled) void l.release().catch(() => {});
          else lock = l;
        },
        () => {
          // Refused (low battery, unsupported): the screen just follows the phone's own setting.
        }
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  // Every step change can be taken back for a few seconds, whatever caused it.
  const [undoStep, setUndoStep] = useState<{ from: number; to: number } | null>(null);
  const previousStepRef = useRef(currentStepIndex);
  const skipUndoRef = useRef(false);
  useEffect(() => {
    const from = previousStepRef.current;
    previousStepRef.current = currentStepIndex;
    if (from === currentStepIndex) return;
    if (skipUndoRef.current) {
      skipUndoRef.current = false;
      setUndoStep(null);
      return;
    }
    setUndoStep({ from, to: currentStepIndex });
    const id = window.setTimeout(() => setUndoStep(null), 4000);
    return () => window.clearTimeout(id);
  }, [currentStepIndex]);
  const undoStepChange = () => {
    if (!undoStep) return;
    skipUndoRef.current = true;
    setCurrentStepIndex(undoStep.from);
  };

  // Jumping to a step goes through a list with full-height rows, never the thin progress bar.
  const [stepsOpen, setStepsOpen] = useState(false);

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
  // Finishing clears the saved cook, so nothing is written after that.
  useEffect(() => {
    if (typeof window === 'undefined' || finished) return;
    saveCookingSession({
      recipeId: recipe.id,
      currentStepIndex,
      timers: Object.fromEntries(Object.entries(timers).map(([k, t]) => [k, t])),
      updatedAt: new Date().toISOString(),
      servings,
      unitSystem,
      alertStep: null,
    });
  }, [currentStepIndex, recipe.id, timers, servings, unitSystem, finished]);

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
      setFinished(true);
      clearCookingSession(recipe.id);
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

  // Moving between steps is deliberate: the Back and Next buttons, arrow keys, voice, or a sideways swipe
  // that follows the finger and only commits past about a third of the screen (or on a quick flick).
  // A tap anywhere else does nothing, so a wrist or a wipe of steam never changes the step.
  const dragRef = useRef<{ x: number; y: number; t: number; axis: 'x' | 'y' | null } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const dismissHint = () => {
    setShowHint(false);
    try {
      window.localStorage.setItem(COOKING_HINT_KEY, '1');
    } catch {
      // Private mode: the hint just shows again next time.
    }
  };

  const handleDragStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    dragRef.current = touch && !finished && !showPrep ? { x: touch.clientX, y: touch.clientY, t: Date.now(), axis: null } : null;
  };

  const handleDragMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    const touch = e.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (start.axis === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) start.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    if (start.axis !== 'x') return;
    // Past the first or last step the card resists instead of following.
    const atEdge = (dx > 0 && currentStepIndex === 0) || (dx < 0 && isLastStep);
    setDragging(true);
    setDragX(atEdge ? dx * 0.25 : dx);
  };

  const handleDragEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    setDragX(0);
    const touch = e.changedTouches[0];
    if (!start || !touch || start.axis !== 'x') return;
    const dx = touch.clientX - start.x;
    const speed = Math.abs(dx) / Math.max(1, Date.now() - start.t);
    const committed = Math.abs(dx) > window.innerWidth * 0.35 || (speed > 0.6 && Math.abs(dx) > 40);
    if (!committed) return; // let go early: the card springs back
    dismissHint();
    if (dx < 0) {
      // On the last step only the Finish button finishes, so a stray swipe cannot fire the confetti.
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
      if (confirmLeave) {
        if (e.key === 'Escape') setConfirmLeave(false);
        return;
      }
      if (stepsOpen) {
        if (e.key === 'Escape') setStepsOpen(false);
        return;
      }
      if (e.key === 'ArrowRight') handleNextStep();
      if (e.key === 'ArrowLeft') handlePrevStep();
      if (e.key === 'Escape') requestClose();
      if (e.key === ' ' && timerSecondsLeft !== null) {
        e.preventDefault();
        setIsTimerRunning((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, timerSecondsLeft, finished, showPrep, confirmLeave, stepsOpen, runningTimerCount]);

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
    <div role="dialog" aria-modal="true" aria-label={`Cooking mode: ${recipe.title}`} data-story-surface className="stone-original fixed inset-0 z-[60] bg-ink-deep/95 backdrop-blur-xl flex flex-col items-center justify-between text-stone-100 select-none overflow-hidden animate-in fade-in duration-200">
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

      {confirmLeave && (
        <div data-no-tap className="absolute inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] cursor-default">
          <div role="alertdialog" aria-modal="true" aria-labelledby="leave-cooking-title" aria-describedby="leave-cooking-body" className="w-full max-w-sm rounded-3xl bg-stone-900 border border-white/10 p-6 flex flex-col gap-4 text-stone-100">
            <h2 id="leave-cooking-title" className="text-2xl text-white">Leave cooking?</h2>
            <p id="leave-cooking-body" className="text-base text-white/80 leading-relaxed">
              {runningTimerCount === 1 ? '1 timer is' : `${runningTimerCount} timers are`} still running. {runningTimerCount === 1 ? 'It keeps' : 'They keep'} going, and Heirloom will ring when {runningTimerCount === 1 ? 'it finishes' : 'they finish'}.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" autoFocus onClick={() => setConfirmLeave(false)} className="min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-on-accent text-base font-semibold">
                Keep cooking
              </button>
              <button type="button" onClick={onClose} className="min-h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-base font-semibold">
                Leave cooking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Ambient Glow */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-3xl scale-110 pointer-events-none"
        style={{ backgroundImage: `url(${recipe.heroImage})` }}
      />

      {/* Top Header & Instagram Story Progress Bars */}
      <div className="relative w-full max-w-2xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 z-20 flex flex-col gap-5">
        {/* Undo for the last step change. It sits over the top of the card (the step's small title), never
            over a control, so reaching for the timer or the step's buttons can't hit it by mistake. */}
        {undoStep && (
          <div role="status" className="absolute top-full inset-x-0 mt-1 flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-900 pl-4 pr-1 py-1 shadow-lg text-sm font-semibold">
              <span>Now on step {undoStep.to + 1}</span>
              <button type="button" onClick={undoStepChange} className="min-h-10 px-3 rounded-full hover:bg-stone-200 underline underline-offset-2">
                Back to {undoStep.from + 1}
              </button>
            </div>
          </div>
        )}
        {/* Progress Segments */}
        <div className="flex items-center gap-1.5 w-full">
          {recipe.steps.map((_, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <span key={idx} aria-hidden="true" className="flex-1 block h-1 rounded-full bg-white/20 overflow-hidden">
                <span
                  className={`block h-full transition-all duration-300 ${
                    isCompleted ? 'bg-amber-400 w-full' : isCurrent ? 'bg-white w-full shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'w-0'
                  }`}
                />
              </span>
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
            Swipe the card or use the buttons at the bottom.
          </p>
        )}

        {/* Top Controls Bar */}
        <div className="flex items-center justify-between text-white/90">
          <div className="flex items-center gap-3">
            <button
              onClick={requestClose}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
              title="Close Cooking Mode"
              aria-label="Close cooking mode"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col min-w-0">
              <button
                type="button"
                onClick={() => setStepsOpen(true)}
                aria-haspopup="dialog"
                className="self-start min-h-8 inline-flex items-center gap-1 text-sm font-semibold tracking-wider uppercase text-amber-300 hover:text-amber-200"
              >
                Step {currentStepIndex + 1} of {totalSteps}
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">: show all steps</span>
              </button>
              <span className="text-sm text-white/80 italic truncate max-w-[120px] xs:max-w-[180px] sm:max-w-md">
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
            <div className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium tracking-wide whitespace-nowrap">
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
      <div
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
        className="flex-1 min-h-0 w-full flex justify-center overflow-y-auto overflow-x-hidden overscroll-contain z-10 touch-pan-y"
      >
      <div
        className={`relative w-full max-w-2xl px-4 py-2 my-auto ${dragging ? '' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'}`}
        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}
      >
        {/* The Card */}
        <div className="w-full bg-ink/80 border border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl flex flex-col gap-6 relative z-20">
          {/* Step title (only when the recipe gave one) and the heat */}
          {(currentStep.title || currentStep.temperature || ovenNow) && (
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              {/* The title is a small running head, so the instruction is the only large text. */}
              {currentStep.title ? <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-white/70 pt-2">{currentStep.title}</h2> : <span />}
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
                  className={`font-serif font-semibold tabular-nums leading-none ${(initialTimerDuration ?? 0) >= 3600 ? 'text-5xl sm:text-6xl' : 'text-6xl sm:text-7xl'} ${
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
                    <div key={ing.id} className="flex items-baseline gap-3 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-xl sm:text-2xl leading-snug text-stone-100">
                      <span className="font-serif font-semibold tabular-nums text-amber-300 shrink-0">{quantity}</span>
                      <span>
                        {ing.name}
                        {ing.notes ? <span className="text-stone-400 text-lg sm:text-xl">, {ing.notes}</span> : null}
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

      {/* Thumb bar: Back takes a third, Next two thirds, tall enough to hit without looking. */}
      <div className="relative w-full max-w-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] z-20">
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={currentStepIndex === 0}
            aria-label="Previous step"
            className="min-h-[4.5rem] rounded-2xl inline-flex items-center justify-center gap-1.5 text-lg font-semibold bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-white/10"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            onClick={handleNextStep}
            className="min-h-[4.5rem] rounded-2xl inline-flex items-center justify-center gap-2 text-lg font-semibold bg-amber-500 hover:bg-amber-400 text-on-accent shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-transform motion-reduce:transition-none"
          >
            {isLastStep ? (
              <>
                <Sparkles className="w-5 h-5" aria-hidden="true" />
                Finish
              </>
            ) : (
              <>
                Next step
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      {stepsOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={() => setStepsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-steps-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl bg-stone-900 border border-white/10 text-stone-100 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h2 id="all-steps-title" className="text-2xl text-white">All steps</h2>
              <button type="button" onClick={() => setStepsOpen(false)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close step list">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <ol className="overflow-y-auto px-3 pb-3 flex flex-col gap-1">
              {recipe.steps.map((step, idx) => {
                const timer = timers[idx];
                const running = timer && timer.endsAt !== null;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      autoFocus={idx === currentStepIndex}
                      onClick={() => {
                        setCurrentStepIndex(idx);
                        setStepsOpen(false);
                      }}
                      aria-current={idx === currentStepIndex ? 'step' : undefined}
                      className={`w-full min-h-14 px-3 rounded-2xl flex items-center gap-3 text-left ${idx === currentStepIndex ? 'bg-amber-500/20 text-white' : 'hover:bg-white/10'}`}
                    >
                      <span className={`font-serif text-2xl tabular-nums w-8 shrink-0 text-right ${idx < currentStepIndex ? 'text-amber-400' : 'text-white/60'}`}>{idx + 1}</span>
                      <span className="flex-1 min-w-0 text-base font-medium">{stepLabel(step)}</span>
                      {running && <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-300">{formatClock(secondsLeftOf(timer, now))}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
