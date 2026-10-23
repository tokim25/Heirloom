import React, { useState } from 'react';
import { Sprout } from './ui/Sprout.tsx';

interface CookingFinishProps {
  title: string;
  /** Minutes since cooking started, or null when it cannot be known (a resumed session). */
  minutes: number | null;
  onDone: (note: string) => void;
  onBack: () => void;
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

/** A quiet ending: no confetti, no sound. One tap closes it; a note for next time is optional and kept on the recipe. */
export const CookingFinish: React.FC<CookingFinishProps> = ({ title, minutes, onDone, onBack }) => {
  const [note, setNote] = useState('');
  const hasNote = note.trim().length > 0;

  return (
    <div role="group" aria-label="Finished cooking" className="absolute inset-0 z-30 bg-ink-deep/95 flex flex-col items-center justify-center gap-6 px-6 text-center text-stone-100">
      <Sprout size={84} className="text-stone-100" />
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-4xl">Dinner is served</h2>
        <p className="text-base text-stone-300">
          {title}
          {minutes !== null && minutes >= 2 ? ` · cooked in ${formatDuration(minutes)}` : ''}
        </p>
      </div>

      <label className="w-full max-w-sm flex flex-col gap-2 text-left">
        <span className="text-sm text-stone-300">Anything to remember for next time? (optional)</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Less salt. Double the garlic."
          className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-base text-white placeholder:text-stone-400 focus:outline-none focus:border-amber-400"
        />
      </label>

      <div className="flex flex-col items-center gap-2 w-full max-w-sm">
        <button
          type="button"
          onClick={() => onDone(note.trim())}
          className="w-full min-h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-on-accent text-base font-semibold"
        >
          {hasNote ? 'Save note and finish' : 'Done'}
        </button>
        <button type="button" onClick={onBack} className="min-h-11 px-4 text-sm font-semibold text-stone-300 hover:text-white">
          Back to the last step
        </button>
      </div>
    </div>
  );
};
