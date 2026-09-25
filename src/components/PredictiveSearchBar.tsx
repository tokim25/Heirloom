import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChefHat, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import {
  createRecipeSearchIndex,
  getPredictiveRecipeSuggestions,
  PredictiveSearchResult,
} from '../utils/searchEngine.ts';

interface PredictiveSearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onSelectCuisine: (cuisine: string) => void;
  resultsCount: number;
}

export const PredictiveSearchBar: React.FC<PredictiveSearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  recipes,
  onSelectRecipe,
  onSelectCuisine,
  resultsCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cached Fuse index for instant fuzzy evaluation
  const fuseIndex = useMemo(() => createRecipeSearchIndex(recipes), [recipes]);

  // Predictive suggestions
  const suggestions: PredictiveSearchResult = useMemo(() => {
    return getPredictiveRecipeSuggestions(searchQuery, recipes, fuseIndex);
  }, [searchQuery, recipes, fuseIndex]);

  const hasSuggestions =
    suggestions.matchingRecipes.length > 0 ||
    suggestions.matchingIngredients.length > 0 ||
    suggestions.matchingCuisines.length > 0;

  // Flatten suggestions for keyboard navigation
  const flatItems = useMemo(() => {
    const items: Array<{
      type: 'recipe' | 'ingredient' | 'cuisine';
      data: any;
    }> = [];

    suggestions.matchingRecipes.forEach((r) =>
      items.push({ type: 'recipe', data: r.recipe })
    );
    suggestions.matchingIngredients.forEach((ing) =>
      items.push({ type: 'ingredient', data: ing })
    );
    suggestions.matchingCuisines.forEach((c) =>
      items.push({ type: 'cuisine', data: c })
    );

    return items;
  }, [suggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatItems.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item.type === 'recipe') {
          onSelectRecipe(item.data);
          setIsOpen(false);
        } else if (item.type === 'ingredient') {
          setSearchQuery(item.data.name);
          setIsOpen(false);
        } else if (item.type === 'cuisine') {
          onSelectCuisine(item.data);
          setIsOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full md:max-w-md">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (searchQuery.trim().length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search recipes, ingredients (e.g. olive oil, burrata)..."
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-white border border-stone-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 shadow-xs transition-all"
        />

        {searchQuery ? (
          <button
            onClick={() => {
              setSearchQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-700 transition-colors"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Predictive Suggestions Dropdown */}
      {isOpen && searchQuery.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-stone-100 max-h-[420px] overflow-y-auto">
          {/* Header pill indicator */}
          <div className="px-3.5 py-2 bg-stone-50/80 flex items-center justify-between text-[11px] text-stone-500">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Predictive & Fuzzy Matches</span>
            </div>
            <span className="font-mono text-[10px] text-stone-400">
              {resultsCount} in cookbook
            </span>
          </div>

          {!hasSuggestions ? (
            <div className="p-4 text-center text-xs text-stone-500">
              No matching recipes or ingredients found for &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <>
              {/* Recipe matches */}
              {suggestions.matchingRecipes.length > 0 && (
                <div className="p-1.5">
                  <div className="px-2 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    Recipes ({suggestions.matchingRecipes.length})
                  </div>
                  {suggestions.matchingRecipes.map(({ recipe, matchReason }) => {
                    const globalIdx = flatItems.findIndex(
                      (item) => item.type === 'recipe' && item.data.id === recipe.id
                    );
                    const isSelected = selectedIndex === globalIdx;

                    return (
                      <button
                        key={recipe.id}
                        onClick={() => {
                          onSelectRecipe(recipe);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-xl flex items-center gap-3 transition-colors ${
                          isSelected ? 'bg-amber-500/10 text-stone-900' : 'hover:bg-stone-50 text-stone-800'
                        }`}
                      >
                        {recipe.heroImage ? (
                          <img
                            src={recipe.heroImage}
                            alt={recipe.title}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-stone-200/60"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0 text-stone-400">
                            <ChefHat className="w-4 h-4" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-stone-900 truncate">
                            {recipe.title}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-0.5">
                            <span className="font-medium text-amber-800">{recipe.cuisine}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {recipe.totalTimeMinutes}m
                            </span>
                            {matchReason && (
                              <>
                                <span>•</span>
                                <span className="text-stone-400 italic truncate max-w-[120px]">
                                  {matchReason}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Ingredient matches */}
              {suggestions.matchingIngredients.length > 0 && (
                <div className="p-1.5">
                  <div className="px-2 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    Ingredients in your kitchen
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {suggestions.matchingIngredients.map((ing) => {
                      const globalIdx = flatItems.findIndex(
                        (item) => item.type === 'ingredient' && item.data.name === ing.name
                      );
                      const isSelected = selectedIndex === globalIdx;

                      return (
                        <button
                          key={ing.name}
                          onClick={() => {
                            setSearchQuery(ing.name);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                            isSelected ? 'bg-amber-500/10 text-stone-900' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <span className="font-medium truncate capitalize">
                            {ing.name}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono shrink-0 ml-2">
                            in {ing.recipesCount} recipe{ing.recipesCount > 1 ? 's' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cuisine matches */}
              {suggestions.matchingCuisines.length > 0 && (
                <div className="p-1.5">
                  <div className="px-2 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    Cuisines
                  </div>
                  <div className="flex flex-wrap gap-1 px-1 py-0.5">
                    {suggestions.matchingCuisines.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          onSelectCuisine(c);
                          setIsOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-medium transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer keyboard hint */}
          <div className="px-3.5 py-1.5 bg-stone-50/60 text-[10px] text-stone-400 flex items-center justify-between">
            <span>Press <kbd className="px-1 py-0.5 bg-white border border-stone-200 rounded text-[9px]">↓</kbd> <kbd className="px-1 py-0.5 bg-white border border-stone-200 rounded text-[9px]">↑</kbd> to navigate</span>
            <span><kbd className="px-1 py-0.5 bg-white border border-stone-200 rounded text-[9px]">Enter</kbd> to select</span>
          </div>
        </div>
      )}
    </div>
  );
};
