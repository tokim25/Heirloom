import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  Flame,
  ChefHat,
  Filter,
} from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import {
  IngredientFacet,
  getIngredientFacets,
  RecipeOrganizationFilter,
} from '../utils/recipeTaxonomy.ts';
import { sounds } from '../utils/sound.ts';

interface IngredientOrganizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  filter: RecipeOrganizationFilter;
  setFilter: React.Dispatch<React.SetStateAction<RecipeOrganizationFilter>>;
}

export const IngredientOrganizerModal: React.FC<IngredientOrganizerModalProps> = ({
  isOpen,
  onClose,
  recipes,
  filter,
  setFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeIngredients, setActiveIngredients] = useState<string[]>(filter.selectedIngredients || []);
  const [mode, setMode] = useState<'all' | 'any'>(filter.ingredientFilterMode || 'any');

  // Compute inverted ingredient index
  const facets: IngredientFacet[] = useMemo(() => {
    return getIngredientFacets(recipes);
  }, [recipes]);

  // Categories present in facets
  const categories = useMemo(() => {
    const set = new Set<string>();
    facets.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return ['All', ...Array.from(set)];
  }, [facets]);

  // Filtered ingredients
  const filteredFacets = useMemo(() => {
    return facets.filter((f) => {
      const matchesSearch =
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.normalizedName.includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [facets, searchTerm, selectedCategory]);

  // Real-time matched recipes preview
  const matchedRecipes = useMemo(() => {
    if (activeIngredients.length === 0) return [];
    return recipes.filter((recipe) => {
      const ingNames = recipe.ingredients.map((i) => i.name.toLowerCase());
      if (mode === 'all') {
        return activeIngredients.every((target) =>
          ingNames.some((n) => n.includes(target.toLowerCase()))
        );
      }
      return activeIngredients.some((target) =>
        ingNames.some((n) => n.includes(target.toLowerCase()))
      );
    });
  }, [recipes, activeIngredients, mode]);

  const toggleIngredient = (normalizedName: string) => {
    sounds.playCheckTick();
    setActiveIngredients((prev) => {
      if (prev.includes(normalizedName)) {
        return prev.filter((i) => i !== normalizedName);
      } else {
        return [...prev, normalizedName];
      }
    });
  };

  const handleApply = () => {
    setFilter((prev) => ({
      ...prev,
      selectedIngredients: activeIngredients,
      ingredientFilterMode: mode,
    }));
    onClose();
  };

  const handleClear = () => {
    setActiveIngredients([]);
    setFilter((prev) => ({
      ...prev,
      selectedIngredients: [],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAF9F5] w-full max-w-2xl rounded-3xl border border-stone-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200/80 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-stone-900 leading-tight">
                Organize by Ingredient
              </h2>
              <p className="text-xs text-stone-500">
                Instant inverted index across {recipes.length} recipes & {facets.length} unique ingredients
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Mode Toggles */}
        <div className="p-6 border-b border-stone-200/80 bg-white space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search garlic, butter, salmon, kale..."
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Active selection row & Matching Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Match Rule:
              </span>
              <div className="inline-flex bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                <button
                  onClick={() => setMode('any')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    mode === 'any' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Has Any ({activeIngredients.length})
                </button>
                <button
                  onClick={() => setMode('all')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    mode === 'all' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Must Have All
                </button>
              </div>
            </div>

            {activeIngredients.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset selection ({activeIngredients.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Ingredients Pill Strip */}
        {activeIngredients.length > 0 && (
          <div className="px-6 py-2.5 bg-amber-50/60 border-b border-amber-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider shrink-0">
              Selected:
            </span>
            {activeIngredients.map((item) => (
              <span
                key={item}
                onClick={() => toggleIngredient(item)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 text-xs font-semibold shadow-xs cursor-pointer hover:bg-amber-400 transition-colors"
              >
                <span>{item}</span>
                <X className="w-3 h-3 text-stone-900" />
              </span>
            ))}
          </div>
        )}

        {/* Ingredients Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredFacets.map((facet) => {
              const isSelected = activeIngredients.includes(facet.normalizedName);
              return (
                <button
                  key={facet.normalizedName}
                  onClick={() => toggleIngredient(facet.normalizedName)}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-amber-950 font-semibold shadow-xs'
                      : 'bg-white border-stone-200/80 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="min-w-0 pr-1.5 truncate">
                    <span className="text-xs capitalize block truncate">{facet.name}</span>
                    <span className="text-[10px] text-stone-400 font-medium">{facet.category}</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full shrink-0 font-bold ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {facet.count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredFacets.length === 0 && (
            <div className="text-center py-12 text-stone-400 text-xs">
              No ingredients matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer / Match Summary & Apply */}
        <div className="px-6 py-4 border-t border-stone-200/80 flex items-center justify-between bg-stone-50/70">
          <div className="text-xs text-stone-600">
            {activeIngredients.length > 0 ? (
              <span>
                <strong>{matchedRecipes.length}</strong> {matchedRecipes.length === 1 ? 'recipe matches' : 'recipes match'} your selection
              </span>
            ) : (
              <span>Select ingredients to filter cookbook</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <span>Apply to Cookbook</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
