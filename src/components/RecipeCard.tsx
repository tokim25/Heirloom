import React, { useState } from 'react';
import { useCardParallax } from '../utils/useParallax.ts';
import { useLabel } from '../utils/recipeUsage.ts';
import { Play, Heart, ChefHat } from 'lucide-react';
import { isFavorite, signature } from '../utils/recipePeople.ts';
import { Recipe } from '../types/recipe.ts';

interface RecipeCardProps {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
  onStartCooking: (recipe: Recipe) => void;
  onAddToGroceries: (recipe: Recipe) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onSelect,
  onStartCooking,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const { frameRef, mediaRef } = useCardParallax<HTMLDivElement, HTMLImageElement>();

  const sig = signature(recipe);
  const meta = [recipe.cuisine, recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} min` : '', useLabel(recipe) ?? ''].filter(Boolean);

  return (
    <article
      onClick={() => onSelect(recipe)}
      className="bg-surface rounded-2xl overflow-hidden border border-stone-200/70 hover:border-stone-300 shadow-[0_2px_12px_rgba(43,53,62,0.04)] transition-colors flex flex-col cursor-pointer"
    >
      {/* The photo is the card */}
      <div ref={frameRef} className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
        {recipe.heroImage && !imageFailed ? (
          <img
            ref={mediaRef}
            src={recipe.heroImage}
            alt={recipe.title}
            className="w-full h-full object-cover will-change-transform"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-50 via-stone-100 to-stone-200 flex flex-col items-center justify-center text-center px-6">
            <ChefHat className="w-9 h-9 text-amber-700/70 mb-3" />
            <span className="font-serif text-lg text-stone-800 line-clamp-2">{recipe.title}</span>
          </div>
        )}

        {isFavorite(recipe) && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface/90 text-amber-700 text-xs font-semibold shadow-sm backdrop-blur-md">
            <Heart className="w-3 h-3 fill-current" aria-hidden="true" />
            Family favorite
          </span>
        )}

        {/* The one action on the card */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartCooking(recipe);
          }}
          aria-label={`Cook ${recipe.title}`}
          className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-surface/95 hover:bg-surface text-stone-900 shadow-md backdrop-blur-md flex items-center justify-center transition-transform active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" aria-hidden="true" />
        </button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-1">
        <h3 className="font-serif text-xl sm:text-2xl font-normal text-stone-900 leading-snug line-clamp-2">{recipe.title}</h3>
        {sig?.kind === 'family' ? (
          <p className="font-hand text-xl leading-none text-amber-700">{sig.text}</p>
        ) : sig ? (
          <p className="text-sm text-stone-600">{sig.text}</p>
        ) : null}
        <p className="text-sm text-stone-600">{meta.join(' · ')}</p>
      </div>
    </article>
  );
};
