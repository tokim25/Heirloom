import React, { useEffect, useState } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import { Recipe, SharedRecipe } from '../types/recipe.ts';
import { Sheet } from './ui/Sheet.tsx';

interface SharedRecipeSheetProps {
  shareId: string;
  load: (id: string) => Promise<SharedRecipe | null>;
  /** The copy the person already saved from this link, if any. */
  savedRecipe?: Recipe;
  onSave: (shared: SharedRecipe) => Promise<void>;
  onOpenSaved: () => void;
  onClose: () => void;
}

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; shared: SharedRecipe };

/** What someone sees when they open a share link: a preview and a button to save their own copy. */
export const SharedRecipeSheet: React.FC<SharedRecipeSheetProps> = ({ shareId, load, savedRecipe, onSave, onOpenSaved, onClose }) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load(shareId)
      .then((shared) => !cancelled && setState(shared ? { status: 'ready', shared } : { status: 'missing' }))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const shared = state.status === 'ready' ? state.shared : null;
  const recipe = shared?.recipe;

  const save = async () => {
    if (!shared) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(shared);
    } catch {
      setError('Could not save this recipe. Check your connection and try again.');
      setSaving(false);
    }
  };

  const facts = recipe
    ? [recipe.cuisine, recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} min` : null, `${recipe.defaultServings} servings`].filter(Boolean).join(' · ')
    : '';

  return (
    <Sheet
      open
      onClose={onClose}
      title={recipe?.title ?? 'Shared recipe'}
      description={shared ? `Shared by ${shared.fromName}` : undefined}
      size="md"
      footer={
        shared ? (
          <>
            <button type="button" onClick={onClose} className="min-h-11 px-4 text-sm font-semibold text-stone-700 hover:text-stone-950 rounded-xl">
              Not now
            </button>
            {savedRecipe ? (
              <button
                type="button"
                onClick={onOpenSaved}
                className="min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover text-white text-base font-semibold"
              >
                Open my copy
              </button>
            ) : (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="min-h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-on-accent text-base font-semibold inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Save to my cookbook
              </button>
            )}
          </>
        ) : (
          <button type="button" onClick={onClose} className="min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover text-white text-base font-semibold">
            Close
          </button>
        )
      }
    >
      {state.status === 'loading' && (
        <p className="flex items-center gap-2 text-stone-600" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Opening the recipe…
        </p>
      )}

      {state.status === 'missing' && (
        <div role="alert">
          <p className="text-base text-stone-900 font-semibold">This link isn't available.</p>
          <p className="text-sm text-stone-600 mt-1">The person may have stopped sharing it, or the link may be incomplete. Ask them to send it again.</p>
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          Could not open this recipe. Check your connection and try again.
        </p>
      )}

      {recipe && (
        <>
          <div className="rounded-2xl overflow-hidden bg-stone-100 h-40 flex items-center justify-center">
            {recipe.heroImage && !imageFailed ? (
              <img
                src={recipe.heroImage}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <ChefHat className="w-10 h-10 text-amber-700/60" aria-hidden="true" />
            )}
          </div>
          <p className="text-sm text-stone-600">{facts}</p>
          {recipe.description && <p className="text-base text-stone-800">{recipe.description}</p>}

          <section aria-label="Ingredients">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              {recipe.ingredients.length} {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
            </h3>
            <ul className="text-base text-stone-800 flex flex-col gap-0.5">
              {recipe.ingredients.slice(0, 8).map((ing) => (
                <li key={ing.id}>{ing.name}</li>
              ))}
            </ul>
            {recipe.ingredients.length > 8 && <p className="text-sm text-stone-600 mt-1">and {recipe.ingredients.length - 8} more</p>}
          </section>
          <p className="text-sm text-stone-600">
            {recipe.steps.length} {recipe.steps.length === 1 ? 'step' : 'steps'}
          </p>

          {savedRecipe && <p className="text-sm text-emerald-700 dark:text-emerald-300">This recipe is already in your cookbook.</p>}
          {error && (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
};
