import React, { useState } from 'react';
import { useLabel } from '../utils/recipeUsage.ts';
import { ChefHat, ChevronRight, Play } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';

interface RecipeRowProps {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
  onStartCooking: (recipe: Recipe) => void;
}

/** One recipe as a compact row, for scanning a long cookbook quickly. */
export const RecipeRow: React.FC<RecipeRowProps> = ({ recipe, onSelect, onStartCooking }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const facts = [recipe.cuisine, recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} min` : null, recipe.difficulty, useLabel(recipe)]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={() => onSelect(recipe)}
        className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left rounded-2xl hover:bg-stone-50 active:bg-stone-100 transition-colors"
      >
        <span className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center">
          {recipe.heroImage && !imageFailed ? (
            <img
              src={recipe.heroImage}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <ChefHat className="w-6 h-6 text-amber-700/70" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-lg leading-snug text-stone-900 line-clamp-2">{recipe.title}</span>
          <span className="block text-sm text-stone-600 truncate">{facts}</span>
          <span className="block text-sm text-stone-500">
            {recipe.ingredients.length} {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 shrink-0 text-stone-400" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onStartCooking(recipe)}
        aria-label={`Start cooking ${recipe.title}`}
        title="Start cooking"
        className="min-h-11 min-w-11 shrink-0 inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-on-accent"
      >
        <Play className="w-4 h-4 fill-current" aria-hidden="true" />
      </button>
    </li>
  );
};
