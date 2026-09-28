import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import { cleanRecipeForSave, validateRecipeForSave } from '../utils/recipeSchema.ts';
import { RecipeEditor } from './RecipeEditor.tsx';

interface RecipeEditModalProps {
  recipe: Recipe;
  onSave: (recipe: Recipe) => Promise<void>;
  onClose: () => void;
}

export const RecipeEditModal: React.FC<RecipeEditModalProps> = ({ recipe, onSave, onClose }) => {
  const [draft, setDraft] = useState<Recipe>(recipe);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(recipe);

  const requestClose = () => {
    if (isDirty && !window.confirm('Discard your changes?')) return;
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleSave = async () => {
    const invalid = validateRecipeForSave(draft);
    if (invalid) return setError(invalid);
    setError(null);
    setIsSaving(true);
    try {
      await onSave(cleanRecipeForSave(draft));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-recipe-title"
        className="w-full sm:max-w-xl bg-[#FAF9F5] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]"
      >
        <div className="px-6 pt-5 pb-4 border-b border-stone-200/80 flex items-center justify-between gap-3">
          <h2 id="edit-recipe-title" className="font-serif text-2xl text-stone-900">
            Edit recipe
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="min-h-11 min-w-11 -mr-2 inline-flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-stone-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {error && (
            <div ref={errorRef} role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <RecipeEditor recipe={draft} onChange={setDraft} />
        </div>

        <div className="p-4 sm:px-6 border-t border-stone-200/80 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            className="min-h-11 px-4 text-sm font-semibold text-stone-700 hover:text-stone-950 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="inline-flex items-center gap-2 min-h-12 px-6 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-base font-semibold"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};
