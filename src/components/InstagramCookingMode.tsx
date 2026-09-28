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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Recipe } from '../types/recipe.ts';
import { scaleQuantity, formatFraction, formatStepTemperatures, UnitSystem } from '../utils/units.ts';
import { sounds } from '../utils/sound.ts';

interface InstagramCookingModeProps {
  recipe: Recipe;
  servings: number;
  unitSystem: UnitSystem;
  onClose: () => void;
  onAddStepIngredientsToGroceries?: (stepIngredients: string[]) => void;
}

interface StoredCookingSession {
  recipeId: string;
  currentStepIndex: number;
  timerSecondsLeft: number | null;
  isTimerRunning: boolean;
  initialTimerDuration: number | null;
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

    const parsed = JSON.parse(raw) as Partial<StoredCookingSession>;
    if (parsed.recipeId !== recipeId || typeof parsed.currentStepIndex !== 'number') {
      return null;
    }

    const currentStepIndex = Math.max(0, Math.min(totalSteps - 1, parsed.currentStepIndex));
    const timerSecondsLeft =
      typeof parsed.timerSecondsLeft === 'number' && parsed.timerSecondsLeft >= 0
        ? parsed.timerSecondsLeft
        : null;
    const initialTimerDuration =
      typeof parsed.initialTimerDuration === 'number' && parsed.initialTimerDuration > 0
        ? parsed.initialTimerDuration
        : timerSecondsLeft;

    return {
      recipeId,
      currentStepIndex,
      timerSecondsLeft,
      isTimerRunning: Boolean(parsed.isTimerRunning && timerSecondsLeft !== null && timerSecondsLeft > 0),
      initialTimerDuration,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const InstagramCookingMode: React.FC<InstagramCookingModeProps> = ({
  recipe,
  servings,
  unitSystem,
  onClose,
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
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedCommand, setRecognizedCommand] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(true);

  // Timer state for current step
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(
    () => restoredSessionRef.current?.timerSecondsLeft ?? null
  );
  const [isTimerRunning, setIsTimerRunning] = useState(
    () => restoredSessionRef.current?.isTimerRunning || false
  );
  const [initialTimerDuration, setInitialTimerDuration] = useState<number | null>(
    () => restoredSessionRef.current?.initialTimerDuration ?? null
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  const currentStep = recipe.steps[currentStepIndex];
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Sync step timer whenever step changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const restoredSession = restoredSessionRef.current;
    if (restoredSession && restoredSession.currentStepIndex === currentStepIndex) {
      setTimerSecondsLeft(restoredSession.timerSecondsLeft);
      setInitialTimerDuration(restoredSession.initialTimerDuration);
      setIsTimerRunning(restoredSession.isTimerRunning);
      restoredSessionRef.current = null;
      return;
    }

    restoredSessionRef.current = null;
    setIsTimerRunning(false);

    if (currentStep?.timerSeconds && currentStep.timerSeconds > 0) {
      setTimerSecondsLeft(currentStep.timerSeconds);
      setInitialTimerDuration(currentStep.timerSeconds);
    } else {
      setTimerSecondsLeft(null);
      setInitialTimerDuration(null);
    }
  }, [currentStepIndex, currentStep]);

  // Auto-save cooking progress so closing Stories mode does not lose place.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const session: StoredCookingSession = {
      recipeId: recipe.id,
      currentStepIndex,
      timerSecondsLeft,
      isTimerRunning,
      initialTimerDuration,
      updatedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(cookingSessionStorageKey, JSON.stringify(session));
    } catch {}
  }, [
    cookingSessionStorageKey,
    currentStepIndex,
    initialTimerDuration,
    isTimerRunning,
    recipe.id,
    timerSecondsLeft,
  ]);

  // Timer countdown loop
  useEffect(() => {
    if (isTimerRunning && timerSecondsLeft !== null && timerSecondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimerSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            setIsTimerRunning(false);
            if (soundEnabled) {
              sounds.playTimerComplete();
            }
            speakNotification("Timer complete! Your step is done.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerSecondsLeft === 0) {
      setIsTimerRunning(false);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timerSecondsLeft, soundEnabled]);

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
    if (soundEnabled) sounds.playCheckTick();
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Completed all steps!
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(cookingSessionStorageKey);
      }
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D97706', '#059669', '#E11D48', '#F59E0B'],
      });
      speakNotification("Bon appétit! You've finished cooking this recipe.");
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      if (soundEnabled) sounds.playCheckTick();
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Story navigation: tap the left third to go back, anywhere else to go forward, or swipe.
  // Buttons, links and form fields inside the card keep their own behavior.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreTapUntilRef = useRef(0);

  const handleStoryTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() < ignoreTapUntilRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, label, summary, [data-no-tap]')) return;
    if (window.getSelection()?.toString()) return; // the reader is selecting text, not navigating
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) {
      handlePrevStep();
    } else if (!isLastStep) {
      // On the last step, only the Finish button finishes, so a stray tap cannot fire the confetti.
      handleNextStep();
    }
  };

  const handleStoryTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleStoryTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = e.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    ignoreTapUntilRef.current = Date.now() + 400; // a swipe must not also count as a tap
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
  }, [currentStepIndex, timerSecondsLeft]);

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Get ingredients used specifically in this step
  const stepIngredientItems = recipe.ingredients.filter((ing) => {
    if (!currentStep.stepIngredients || currentStep.stepIngredients.length === 0) return false;
    return currentStep.stepIngredients.some(
      (name) => ing.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(ing.name.toLowerCase())
    );
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={`Cooking mode: ${recipe.title}`} className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-xl flex flex-col items-center justify-between text-stone-100 select-none overflow-hidden animate-in fade-in duration-200">
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
              <span className="text-xs font-medium tracking-wider uppercase text-amber-300">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              <span className="text-xs text-white/80 font-serif italic truncate max-w-[110px] xs:max-w-[160px] sm:max-w-md">
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
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                !voiceSupported
                  ? 'bg-white/5 text-white/35 cursor-not-allowed'
                  : isVoiceActive
                  ? 'bg-amber-400 text-stone-950 font-semibold shadow-[0_0_12px_rgba(251,191,36,0.5)]'
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
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-all"
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

      {/* Main Story Content Card. The whole area is the tap surface: left third = back, rest = next. */}
      <div
        onClick={handleStoryTap}
        onTouchStart={handleStoryTouchStart}
        onTouchEnd={handleStoryTouchEnd}
        data-story-surface
        className="flex-1 w-full flex justify-center z-10 cursor-pointer"
      >
      <div className="relative flex-1 w-full max-w-2xl px-4 py-2 flex flex-col justify-center">
        {/* The Card */}
        <div className="w-full bg-stone-900/80 border border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl flex flex-col gap-6 relative z-20">
          {/* Step Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-semibold tracking-widest uppercase text-amber-400">
                Action {currentStepIndex + 1}
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif tracking-tight text-white mt-1">
                {currentStep.title || `Step ${currentStep.stepNumber}`}
              </h2>
            </div>
            {currentStep.temperature && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentStep.temperature}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-white/70">
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <span className="block text-white font-semibold">Move</span>
              Tap left or right, swipe, or arrow keys
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <span className="block text-white font-semibold">Timer</span>
              Space bar or Start/Pause
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <span className="block text-white font-semibold">Voice</span>
              Say "next", "back", or "repeat"
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <span className="block text-white font-semibold">Close</span>
              Escape or the top-left button
            </div>
          </div>

          {/* Step Instruction Text */}
          <p className="text-lg sm:text-xl text-stone-100 leading-relaxed font-normal tracking-wide">
            {formatStepTemperatures(currentStep.instruction, unitSystem)}
          </p>

          {/* Interactive Cooking Timer (if step has timer) */}
          {timerSecondsLeft !== null && (
            <div className="bg-stone-950/45 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-inner">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                {/* Circular timer progress badge */}
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="27"
                      className="text-white/10 stroke-current"
                      strokeWidth="3"
                      fill="transparent"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="27"
                      className={`transition-all duration-1000 ${
                        timerSecondsLeft === 0
                          ? 'text-emerald-400 animate-pulse'
                          : isTimerRunning
                          ? 'text-amber-400'
                          : 'text-white/50'
                      } stroke-current`}
                      strokeWidth="3.5"
                      strokeDasharray={169.6}
                      strokeDashoffset={
                        initialTimerDuration
                          ? 169.6 * (1 - timerSecondsLeft / initialTimerDuration)
                          : 0
                      }
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <span className="absolute font-mono text-sm font-bold text-white tracking-tight">
                    {formatTime(timerSecondsLeft)}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="text-xs text-white/45 uppercase tracking-[0.22em] font-semibold">
                    {timerSecondsLeft === 0 ? 'Timer Done' : 'Step Timer'}
                  </div>
                  <div className="text-lg font-semibold text-amber-300 leading-snug">
                    {isTimerRunning ? 'Running in kitchen…' : timerSecondsLeft === 0 ? 'Ready to move to next step!' : 'Paused'}
                  </div>
                  <div className="text-xs text-white/45 mt-0.5">
                    {isTimerRunning ? 'You can keep cooking; this will alert you.' : 'Start when this step begins.'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:flex sm:items-center sm:justify-end">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all ${
                    isTimerRunning
                      ? 'bg-white/20 hover:bg-white/30 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                  }`}
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Start
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setTimerSecondsLeft((prev) => (prev ? prev + 60 : 60));
                  }}
                  className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-semibold"
                  title="Add 1 minute"
                >
                  +1m
                </button>

                <button
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSecondsLeft(initialTimerDuration || 0);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Step Specific Ingredients Pill Rack */}
          {stepIngredientItems.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-xs uppercase tracking-wider text-white/50 font-medium">
                Ingredients Needed for this step
              </span>
              <div className="flex flex-wrap gap-2">
                {stepIngredientItems.map((ing) => {
                  const scaledAmount = scaleQuantity(ing.amount, recipe.defaultServings, servings);
                  const formattedFraction = formatFraction(scaledAmount);
                  return (
                    <div
                      key={ing.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs text-stone-200"
                    >
                      <span className="font-semibold text-amber-300">
                        {formattedFraction ? `${formattedFraction} ${ing.unit}` : ing.unit}
                      </span>
                      <span>{ing.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chef's Pro-Tip */}
          {currentStep.tips && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs leading-relaxed">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 mr-1">Chef’s Note:</span>
                {currentStep.tips}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Hands-Free Dirty-Hands Voice Assistant Floating HUD */}
      {isVoiceActive && (
        <div className="w-full max-w-2xl px-4 z-30 flex flex-col items-center gap-1.5 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-stone-900/90 border border-amber-500/40 shadow-xl backdrop-blur-xl text-xs text-stone-200">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75" />
              <Mic className="w-4 h-4 text-amber-400 relative z-10" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-400 text-xs uppercase tracking-wider">
                Hands-Free Active:
              </span>
              {recognizedCommand ? (
                <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-stone-950 font-bold text-xs shadow-xs">
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
          Tap the left or right of the card, swipe, or use arrow keys
        </span>

        <button
          onClick={handleNextStep}
          className="flex items-center gap-2 min-h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
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
