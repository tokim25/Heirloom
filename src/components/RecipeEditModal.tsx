import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import { cleanRecipeForSave, validateRecipeForSave } from '../utils/recipeSchema.ts';
import { RecipeEditor } from './RecipeEditor.tsx';
import { ConfirmSheet, Sheet } from './ui/Sheet.tsx';

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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [error]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(recipe);

  const requestClose = () => {
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  };

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
    <Sheet
      open
      onClose={requestClose}
      title="Edit recipe"
      size="xl"
      dismissible={!isSaving}
      footer={
        <>
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
            className="inline-flex items-center gap-2 min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-40 text-white text-base font-semibold"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save changes
          </button>
        </>
      }
    >
      {error && (
        <div ref={errorRef} role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/50">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <RecipeEditor recipe={draft} onChange={setDraft} />
      <ConfirmSheet
        open={confirmingDiscard}
        title="Discard your changes?"
        message="Your edits to this recipe haven't been saved."
        confirmLabel="Discard"
        destructive
        onConfirm={onClose}
        onCancel={() => setConfirmingDiscard(false)}
      />
    </Sheet>
  );
};
