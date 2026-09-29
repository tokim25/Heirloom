import React, { useState } from 'react';
import { Filter, Clock, Flame, Utensils, RotateCcw, ChevronDown, Layers, X } from 'lucide-react';
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
  const timeLabels: Record<TimeBracket, string> = {
    all: 'Any duration',
    quick: 'Quick',
    moderate: '25-45m',
    slow: '45m+',
  };
  const prepLabels: Record<PrepBracket, string> = {
    all: 'Any prep',
    express: 'Express prep',
    involved: 'Involved prep',
  };
  const proteinLabels: Record<ProteinCategory, string> = {
    all: 'Any hero ingredient',
    seafood: 'Fish & seafood',
    poultry: 'Poultry',
    meat: 'Meat & pork',
    pasta: 'Pasta & grains',
    vegetarian: 'Vegetarian',
  };
  const activeFilterBadges = [
    filter.cuisine !== 'All' ? `Cuisine: ${filter.cuisine}` : null,
    filter.proteinCategory !== 'all' ? proteinLabels[filter.proteinCategory] : null,
    filter.timeBracket !== 'all' ? timeLabels[filter.timeBracket] : null,
    filter.prepBracket !== 'all' ? prepLabels[filter.prepBracket] : null,
    filter.searchQuery.trim() ? 'Search active' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Primary Organization Row: essential actions only */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-stone-900">
            {totalFilteredCount} {totalFilteredCount === 1 ? 'recipe' : 'recipes'}
          </span>
          <span className="text-xs text-stone-500">
            {hasActiveFilters ? `Filtered from ${recipes.length}` : 'Your cookbook'}
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {/* Instant Organize By Ingredient Trigger */}
          {onOpenIngredientOrganizer && (
            <button
              onClick={onOpenIngredientOrganizer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                selectedIngredientsCount > 0
                  ? 'bg-amber-500 text-on-accent font-bold border-amber-600 shadow-xs'
                  : 'bg-surface border-stone-200/80 text-stone-700 hover:bg-stone-50'
              }`}
              title="Filter recipes by ingredients in your pantry"
            >
              <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Ingredients</span>
              {selectedIngredientsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-ink text-white text-xs font-mono">
                  {selectedIngredientsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              isAdvancedOpen || hasActiveFilters
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 font-semibold dark:text-amber-100'
                : 'bg-surface border-stone-200/80 text-stone-700 hover:bg-stone-50'
            }`}
            title="Filter by prep time or cooking duration"
          >
            <Filter className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Filters</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1 dark:text-amber-100">
            <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Active Filters:
          </span>
          {activeFilterBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-amber-300/80 rounded-xl text-xs font-semibold text-stone-900 shadow-2xs dark:border-amber-700/60"
            >
              {badge}
            </span>
          ))}
          {filter.selectedIngredients.map((ing) => (
            <span
              key={ing}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-amber-300/80 rounded-xl text-xs font-semibold text-stone-900 shadow-2xs dark:border-amber-700/60"
            >
              <span>{ing}</span>
              <button
                onClick={() => handleRemoveIngredient(ing)}
                className="hover:text-rose-600 transition-colors dark:hover:text-rose-400"
                title="Remove ingredient filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={handleResetFilters}
            className="text-xs font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 ml-1 dark:text-amber-200 dark:hover:text-amber-100"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Advanced Dimensions Drawer: Ingredients & Time Taxonomy */}
      {isAdvancedOpen && (
        <div className="p-4 bg-stone-50/80 border border-stone-200/80 rounded-2xl flex flex-col gap-4 transition-all">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Cuisine
              </span>
              <select
                value={filter.cuisine}
                onChange={(e) => setFilter((prev) => ({ ...prev, cuisine: e.target.value }))}
                className="px-3 py-2 bg-surface border border-stone-200 text-stone-800 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs"
              >
                {cuisinesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Sort
              </span>
              <select
                value={filter.sortBy}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, sortBy: e.target.value as typeof prev.sortBy }))
                }
                className="px-3 py-2 bg-surface border border-stone-200 text-stone-800 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs"
              >
                <option value="newest">Recently Added</option>
                <option value="mostUsed">Most Used</option>
                <option value="recentlyUsed">Recently Used</option>
                <option value="quickest">Shortest Cook Time</option>
                <option value="prepTime">Fastest Prep Time</option>
                <option value="alphabetical">Title A-Z</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Dimension 1: Key Ingredient / Protein */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1">
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
                        ? 'bg-ink text-white font-medium shadow-xs'
                        : 'bg-surface text-stone-700 hover:bg-stone-100 border border-stone-200/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-1 text-xs opacity-70">({opt.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimension 2: Total Time Bracket */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1">
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
                        ? 'bg-ink text-white font-medium shadow-xs'
                        : 'bg-surface text-stone-700 hover:bg-stone-100 border border-stone-200/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-1 text-xs opacity-70">({opt.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimension 3: Prep Time (Hands-On Active Time) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1">
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
                        ? 'bg-ink text-white font-medium shadow-xs'
                        : 'bg-surface text-stone-700 hover:bg-stone-100 border border-stone-200/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-1 text-xs opacity-70">({opt.count})</span>
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
                className="flex items-center gap-1 text-xs text-amber-800 hover:text-amber-950 font-medium transition-colors dark:text-amber-200 dark:hover:text-amber-100"
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
