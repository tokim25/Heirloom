import React, { useState } from 'react';
import { Filter, Clock, Flame, Utensils, RotateCcw, ChevronDown, Check, Layers, X } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import {
  RecipeOrganizationFilter,
  TimeBracket,
  PrepBracket,
  ProteinCategory,
  getTaxonomyFacets,
} from '../utils/recipeTaxonomy.ts';

interface RecipeOrganizationToolbarProps {
  filter: RecipeOrganizationFilter;
  setFilter: React.Dispatch<React.SetStateAction<RecipeOrganizationFilter>>;
  recipes: Recipe[];
  totalFilteredCount: number;
  onOpenIngredientOrganizer?: () => void;
}

export const RecipeOrganizationToolbar: React.FC<RecipeOrganizationToolbarProps> = ({
  filter,
  setFilter,
  recipes,
  totalFilteredCount,
  onOpenIngredientOrganizer,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const facets = getTaxonomyFacets(recipes);

  const selectedIngredientsCount = filter.selectedIngredients?.length || 0;

  const hasActiveFilters =
    filter.cuisine !== 'All' ||
    filter.timeBracket !== 'all' ||
    filter.prepBracket !== 'all' ||
    filter.proteinCategory !== 'all' ||
    selectedIngredientsCount > 0 ||
    filter.searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setFilter((prev) => ({
      ...prev,
      cuisine: 'All',
      timeBracket: 'all',
      prepBracket: 'all',
      proteinCategory: 'all',
      selectedIngredients: [],
      searchQuery: '',
    }));
  };

  const handleRemoveIngredient = (ingToRemove: string) => {
    setFilter((prev) => ({
      ...prev,
      selectedIngredients: prev.selectedIngredients.filter((i) => i !== ingToRemove),
    }));
  };

  const cuisinesList = ['All', ...facets.cuisines];

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Primary Organization Row: Cuisines & Quick Toggles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Cuisine Selector Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full md:max-w-xl">
          {cuisinesList.map((c) => {
            const isSelected = filter.cuisine === c;
            return (
              <button
                key={c}
                onClick={() => setFilter((prev) => ({ ...prev, cuisine: c }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200/70 hover:bg-stone-50'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Right Controls: Ingredients Index, Dimensions & Sort */}
        <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
          {/* Instant Organize By Ingredient Trigger */}
          {onOpenIngredientOrganizer && (
            <button
              onClick={onOpenIngredientOrganizer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                selectedIngredientsCount > 0
                  ? 'bg-amber-500 text-stone-950 font-bold border-amber-600 shadow-xs'
                  : 'bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50'
              }`}
              title="Filter recipes by ingredients in your pantry"
            >
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Ingredients</span>
              {selectedIngredientsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-stone-900 text-white text-[10px] font-mono">
                  {selectedIngredientsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              isAdvancedOpen || hasActiveFilters
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 font-semibold'
                : 'bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50'
            }`}
            title="Filter by prep time or cooking duration"
          >
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Dimensions</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={filter.sortBy}
              onChange={(e) =>
                setFilter((prev) => ({ ...prev, sortBy: e.target.value as typeof prev.sortBy }))
              }
              className="px-2.5 py-1.5 bg-white border border-stone-200 text-stone-700 text-xs rounded-xl focus:outline-none shadow-xs"
            >
              <option value="newest">Recently Added</option>
              <option value="quickest">Shortest Cook Time</option>
              <option value="prepTime">Fastest Prep Time</option>
              <option value="alphabetical">Title A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Ingredients Filter Badges */}
      {selectedIngredientsCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            Filtering by Ingredients:
          </span>
          {filter.selectedIngredients.map((ing) => (
            <span
              key={ing}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300/80 rounded-xl text-xs font-semibold text-stone-900 shadow-2xs"
            >
              <span>{ing}</span>
              <button
                onClick={() => handleRemoveIngredient(ing)}
                className="hover:text-rose-600 transition-colors"
                title="Remove ingredient filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={() => setFilter((prev) => ({ ...prev, selectedIngredients: [] }))}
            className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 ml-1"
          >
            Clear all ingredients
          </button>
        </div>
      )}

      {/* Advanced Dimensions Drawer: Ingredients & Time Taxonomy */}
      {isAdvancedOpen && (
        <div className="p-4 bg-stone-50/80 border border-stone-200/80 rounded-2xl flex flex-col gap-4 transition-all">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Dimension 1: Key Ingredient / Protein */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                <Utensils className="w-3 h-3 text-stone-400" />
                Hero Ingredient / Protein
              </span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'all', label: 'All', count: facets.proteinCounts.all },
                    { id: 'seafood', label: 'Fish & Seafood', count: facets.proteinCounts.seafood },
                    { id: 'poultry', label: 'Poultry', count: facets.proteinCounts.poultry },
                    { id: 'meat', label: 'Meat & Pork', count: facets.proteinCounts.meat },
                    { id: 'pasta', label: 'Pasta & Grains', count: facets.proteinCounts.pasta },
                    { id: 'vegetarian', label: 'Vegetarian', count: facets.proteinCounts.vegetarian },
                  ] as Array<{ id: ProteinCategory; label: string; count: number }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setFilter((prev) => ({
                        ...prev,
                        proteinCategory: prev.proteinCategory === opt.id ? 'all' : opt.id,
                      }))
                    }
                    className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                      filter.proteinCategory === opt.id
                        ? 'bg-stone-900 text-white font-medium shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-1 text-[10px] opacity-70">({opt.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimension 2: Total Time Bracket */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-stone-400" />
                Total Cooking Time
              </span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'all', label: 'Any Duration', count: facets.timeCounts.all },
                    { id: 'quick', label: '≤ 25m (Quick)', count: facets.timeCounts.quick },
                    { id: 'moderate', label: '25–45m', count: facets.timeCounts.moderate },
                    { id: 'slow', label: '45m+ (Slow Cook)', count: facets.timeCounts.slow },
                  ] as Array<{ id: TimeBracket; label: string; count: number }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setFilter((prev) => ({
                        ...prev,
                        timeBracket: prev.timeBracket === opt.id ? 'all' : opt.id,
                      }))
                    }
                    className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                      filter.timeBracket === opt.id
                        ? 'bg-stone-900 text-white font-medium shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-1 text-[10px] opacity-70">({opt.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimension 3: Prep Time (Hands-On Active Time) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                <Flame className="w-3 h-3 text-stone-400" />
                Hands-On Prep Time
              </span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'all', label: 'Any Prep', count: facets.prepCounts.all },
                    { id: 'express', label: 'Express Prep (≤ 15m)', count: facets.prepCounts.express },
                    { id: 'involved', label: 'Involved Prep (> 15m)', count: facets.prepCounts.involved },
                  ] as Array<{ id: PrepBracket; label: string; count: number }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setFilter((prev) => ({
                        ...prev,
                        prepBracket: prev.prepBracket === opt.id ? 'all' : opt.id,
                      }))
                    }
                    className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                      filter.prepBracket === opt.id
                        ? 'bg-stone-900 text-white font-medium shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-1 text-[10px] opacity-70">({opt.count})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dimension Footer: Results status & Reset */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 text-xs">
            <span className="text-stone-500 font-medium">
              Showing <strong className="text-stone-900 font-semibold">{totalFilteredCount}</strong> of{' '}
              {recipes.length} recipes
            </span>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 font-medium transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
