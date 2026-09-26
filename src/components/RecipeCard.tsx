import React from 'react';
import { Clock, Users, Play, ShoppingBag, Youtube, ExternalLink, Bookmark } from 'lucide-react';
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
  onAddToGroceries,
}) => {
  return (
    <article
      onClick={() => onSelect(recipe)}
      className="group bg-white rounded-3xl overflow-hidden border border-stone-200/70 hover:border-stone-300 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col cursor-pointer transform hover:-translate-y-1"
    >
      {/* Cinematic Photography Frame */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
        <img
          src={recipe.heroImage}
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 ease-out"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Ambient Dark Gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity" />

        {/* Quiet Source Identifier (Single clean badge) */}
        {recipe.source.type === 'youtube' && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium tracking-wide">
            <Youtube className="w-3.5 h-3.5 text-red-400" />
            <span>YouTube Short</span>
          </div>
        )}

        {recipe.source.type === 'link' && recipe.source.sourceName && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white/90 text-[11px] font-medium tracking-wide">
            <ExternalLink className="w-3 h-3 text-stone-300" />
            <span className="truncate max-w-[130px]">{recipe.source.sourceName}</span>
          </div>
        )}

        {/* Bottom Tactile Action: Cook in Stories Mode */}
        <div className="absolute bottom-3 right-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartCooking(recipe);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-stone-900 text-xs font-semibold shadow-md backdrop-blur-md transition-all active:scale-95 group-hover:bg-amber-400 group-hover:text-stone-950"
            title="Start Instagram Stories Cooking Mode"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Cook Step-by-Step</span>
          </button>
        </div>
      </div>

      {/* Editorial Content Block (Airbnb Typographic Rhythm) */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Zero-Pill Unboxed Metadata Line with typographic dots */}
          <div className="flex items-center gap-1.5 text-xs text-stone-600 mb-2">
            <span className="font-semibold text-stone-700">{recipe.cuisine}</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>{recipe.totalTimeMinutes} min</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>{recipe.difficulty}</span>
          </div>

          <h3 className="font-serif text-xl sm:text-2xl font-normal text-stone-900 leading-snug group-hover:text-stone-700 transition-colors line-clamp-2">
            {recipe.title}
          </h3>

          <p className="text-stone-600 text-xs mt-2.5 line-clamp-2 leading-relaxed">
            {recipe.description}
          </p>
        </div>

        {/* Footnote Bar & Quick Action */}
        <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-3">
            <span>{recipe.ingredients.length} ingredients</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>{recipe.defaultServings} servings</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToGroceries(recipe);
            }}
            className="flex items-center gap-1 text-stone-600 hover:text-stone-900 transition-colors text-xs font-medium py-1 px-2 rounded-lg hover:bg-stone-100"
            title="Add all ingredients to Shared Grocery List"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add List</span>
          </button>
        </div>
      </div>
    </article>
  );
};
