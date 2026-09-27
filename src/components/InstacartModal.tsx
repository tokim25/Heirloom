import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  ExternalLink,
  Store,
  Check,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Recipe, Ingredient, PantryItem } from '../types/recipe.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { scaleQuantity, formatFraction } from '../utils/units.ts';
import { isIngredientInPantry } from '../utils/pantryDefaults.ts';
import { STORES, StoreOption, resolveStore } from '../utils/storeOptions.ts';

interface InstacartModalProps {
  recipe: Recipe;
  servings: number;
  initialStore?: string;
  onClose: () => void;
  onAddSubstitutionsToList?: (items: unknown[]) => void;
  pantryItems?: PantryItem[];
}

interface CartItemState {
  ingredientId: string;
  name: string;
  scaledAmount: number | null;
  unit: string;
  category: string;
  query: string;
  estimatedPrice: number;
  isOutOfStock: boolean;
  isInPantry?: boolean;
  included: boolean;
  substitution?: {
    name: string;
    ratio: string;
    reason: string;
    instacartQuery: string;
  };
  isLoadingSub?: boolean;
}

export const InstacartModal: React.FC<InstacartModalProps> = ({
  recipe,
  servings,
  initialStore,
  onClose,
  onAddSubstitutionsToList,
  pantryItems = [],
}) => {
  const { user, updateProfile } = useAuth();

  // Determine starting store: initialStore prop -> user profile preferredStore -> localStorage -> default Whole Foods
  const [selectedStore, setSelectedStore] = useState<StoreOption>(() => {
    const savedLocal = typeof window !== 'undefined' ? localStorage.getItem('heirloom_preferred_store') : null;
    return resolveStore(initialStore || user?.preferredStore || savedLocal || 'Whole Foods Market');
  });

  const [isChangingStore, setIsChangingStore] = useState(false);
  const [items, setItems] = useState<CartItemState[]>([]);
  const [copied, setCopied] = useState(false);

  // Sync if user profile preferredStore updates and no initialStore override was provided
  useEffect(() => {
    if (!initialStore && user?.preferredStore) {
      setSelectedStore(resolveStore(user.preferredStore));
    }
  }, [user?.preferredStore, initialStore]);

  // Handle changing store and persisting across the app
  const handleSelectStore = (store: StoreOption) => {
    setSelectedStore(store);
    setIsChangingStore(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('heirloom_preferred_store', store.name);
    }
    if (updateProfile) {
      updateProfile({ preferredStore: store.name }).catch((err) => {
        console.error('Failed to update preferred store:', err);
      });
    }
  };

  // Initialize cart items from recipe ingredients scaled to servings
  useEffect(() => {
    const initial: CartItemState[] = recipe.ingredients.map((ing, idx) => {
      const scaled = scaleQuantity(ing.amount, recipe.defaultServings, servings);
      // Simulate out of stock for special produce occasionally to demonstrate chef substitutions
      const outOfStock = idx === 3 && recipe.ingredients.length > 3;
      const inPantry = pantryItems ? isIngredientInPantry(ing.name, pantryItems) : false;

      return {
        ingredientId: ing.id,
        name: ing.name,
        scaledAmount: scaled,
        unit: ing.unit,
        category: ing.category,
        query: ing.instacartQuery || ing.name,
        estimatedPrice: ing.estimatedPrice || Math.round((2.49 + (idx * 1.3) % 7) * 100) / 100,
        isOutOfStock: outOfStock,
        isInPantry: inPantry,
        included: !inPantry, // auto-exclude if already in pantry to save grocery costs
        substitution: outOfStock
          ? {
              name: ing.name.toLowerCase().includes('butter')
                ? 'Ghee or High-Heat Avocado Oil'
                : 'Fresh Oregano or Italian Seasoning',
              ratio: '1:1 ratio direct swap',
              reason: 'Excellent culinary match with identical moisture and flavor profile.',
              instacartQuery: 'Culinary Ghee',
            }
          : undefined,
      };
    });

    setItems(initial);
  }, [recipe, servings, pantryItems]);

  // Request smart AI substitution from Gemini
  const fetchSmartSubstitution = async (index: number) => {
    const item = items[index];
    const newItems = [...items];
    newItems[index] = { ...item, isLoadingSub: true };
    setItems(newItems);

    try {
      const res = await fetch('/api/recipes/substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientName: item.name,
          unit: item.unit,
          amount: item.scaledAmount,
          recipeContext: recipe.title,
          storeName: selectedStore.name,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const topSub = data.substitutions?.[0];
        if (topSub) {
          setItems((prev) => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              isLoadingSub: false,
              substitution: topSub,
            };
            return updated;
          });
        }
      }
    } catch (e) {
      console.error('Failed to get substitution:', e);
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isLoadingSub: false };
        return updated;
      });
    }
  };

  const handleApplySubstitution = (index: number) => {
    const item = items[index];
    if (!item.substitution) return;

    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        name: updated[index].substitution!.name,
        query: updated[index].substitution!.instacartQuery || updated[index].substitution!.name,
        isOutOfStock: false,
      };
      return updated;
    });
  };

  const includedItems = items.filter((i) => i.included);
  const totalPrice = includedItems.reduce((sum, item) => sum + item.estimatedPrice, 0);
  const outOfStockCount = includedItems.filter((i) => i.isOutOfStock).length;

  // Build direct store URL and individual item search URLs
  const storeUrl = selectedStore.slug
    ? `https://www.instacart.com/store/${selectedStore.slug}/storefront`
    : `https://www.instacart.com/store/s?k=${encodeURIComponent(selectedStore.name)}`;

  const getItemSearchUrl = (query: string) => {
    if (selectedStore.slug) {
      return `https://www.instacart.com/store/${selectedStore.slug}/s?k=${encodeURIComponent(query)}`;
    }
    return `https://www.instacart.com/store/s?k=${encodeURIComponent(query)}`;
  };

  // Copy shopping checklist to clipboard
  const handleCopyList = () => {
    const lines = includedItems.map((item) => {
      const qty = formatFraction(item.scaledAmount);
      return `• ${qty ? `${qty} ` : ''}${item.unit ? `${item.unit} ` : ''}${item.name}`;
    });
    const header = `${recipe.title} — ${selectedStore.name} Grocery List (${includedItems.length} items):\n`;
    navigator.clipboard.writeText(`${header}\n${lines.join('\n')}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-stone-200/80 flex items-center justify-between bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Instacart Shopping Handoff
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold whitespace-nowrap leading-none">
                  Store Fulfillment
                </span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl text-stone-900 mt-0.5 leading-snug">
                Prepare Shopping Links for {recipe.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Store Banner (Compact, Remembers User's Default) */}
        <div className="p-4 sm:p-5 bg-white border-b border-stone-200/90 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-stone-900 text-sm sm:text-base truncate">
                    {selectedStore.name}
                  </span>
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full whitespace-nowrap leading-none">
                    <Check className="w-3 h-3 text-emerald-700" />
                    {selectedStore.isCustom ? 'Custom Store' : 'Preferred Store'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>⏱ {selectedStore.delivery}</span>
                  <span>•</span>
                  <span>Min {selectedStore.minOrder}</span>
                  <span>•</span>
                  <span className="truncate">{selectedStore.tagline}</span>
                </p>
                {selectedStore.isCustom && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    This store is saved exactly as chosen. Instacart links will use general search because Heirloom does not have a curated shortcut for it yet.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsChangingStore(!isChangingStore)}
              className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors shrink-0 whitespace-nowrap"
            >
              <span>{isChangingStore ? 'Done' : 'Change Store'}</span>
              {isChangingStore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Expandable Store Picker: Only displayed if user taps "Change Store" */}
          {isChangingStore && (
            <div className="pt-3 border-t border-stone-100 animate-in fade-in duration-150">
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">
                Select Your Default Supermarket
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STORES.map((store) => {
                  const isSelected = selectedStore.id === store.id;
                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => handleSelectStore(store)}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col gap-0.5 transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-600/20'
                          : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-900 truncate">
                          {store.name}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-stone-500 truncate">
                        {store.tagline}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-stone-600">
                        <span>⏱ {store.delivery}</span>
                        <span>•</span>
                        <span>Min {store.minOrder}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Ingredients to Fulfill ({includedItems.length} of {items.length} selected • {servings} servings)
            </span>
            <span className="text-xs font-semibold text-stone-800">
              Est. Total: ${totalPrice.toFixed(2)}
            </span>
          </div>

          {outOfStockCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {outOfStockCount} item is out of stock at {selectedStore.name}. Smart substitutions suggested below.
                </span>
              </div>
            </div>
          )}

          <div className="divide-y divide-stone-100 bg-white rounded-2xl border border-stone-200 shadow-xs">
            {items.map((item, idx) => {
              const qty = formatFraction(item.scaledAmount);
              return (
                <div
                  key={item.ingredientId}
                  className={`p-3.5 flex flex-col gap-2 transition-colors ${
                    item.isOutOfStock ? 'bg-amber-50/40' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx] = { ...item, included: e.target.checked };
                          setItems(updated);
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                        title={item.included ? 'Item included in list' : 'Item excluded from list'}
                      />

                      <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                        <span className={`font-semibold text-xs sm:text-sm ${item.included ? 'text-stone-900' : 'text-stone-400 line-through'}`}>
                          {qty ? `${qty} ${item.unit}` : item.unit}
                        </span>
                        <span className={`text-xs sm:text-sm ${item.included ? 'text-stone-800' : 'text-stone-400 line-through'}`}>
                          {item.name}
                        </span>
                        {item.isInPantry && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-200 whitespace-nowrap leading-none">
                            In Pantry
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-stone-600 font-mono">
                        ${item.estimatedPrice.toFixed(2)}
                      </span>

                      {item.isOutOfStock ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold whitespace-nowrap leading-none">
                          Out of Stock
                        </span>
                      ) : (
                        <a
                          href={getItemSearchUrl(item.query)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 border border-emerald-200/80 transition-colors whitespace-nowrap"
                          title={`Find ${item.name} at ${selectedStore.name} on Instacart`}
                        >
                          <span>Find Item</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Smart Culinary Substitution Card */}
                  {item.isOutOfStock && item.substitution && (
                    <div className="mt-1 p-3 rounded-xl bg-amber-100/60 border border-amber-300/80 flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Chef Substitution: {item.substitution.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplySubstitution(idx)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium shadow-xs"
                        >
                          Use this Sub
                        </button>
                      </div>
                      <p className="text-stone-700 text-[11px] leading-relaxed">
                        <strong className="text-stone-900">Ratio:</strong> {item.substitution.ratio} • <strong className="text-stone-900">Why:</strong> {item.substitution.reason}
                      </p>
                    </div>
                  )}

                  {item.isOutOfStock && !item.substitution && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-800">Need an alternative?</span>
                      <button
                        type="button"
                        onClick={() => fetchSmartSubstitution(idx)}
                        disabled={item.isLoadingSub}
                        className="flex items-center gap-1 text-emerald-700 font-medium hover:underline text-xs"
                      >
                        <RefreshCw className={`w-3 h-3 ${item.isLoadingSub ? 'animate-spin' : ''}`} />
                        <span>{item.isLoadingSub ? 'Consulting Chef…' : 'Suggest AI Substitution'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Transparent How-it-Works Explainer */}
          <div className="p-3 bg-stone-100/70 border border-stone-200 rounded-2xl text-[11px] text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">How Instacart shopping works:</span> Heirloom does not create or manage an Instacart cart. Tap <strong className="text-stone-800">Open {selectedStore.name}</strong> to launch the store, or tap <strong className="text-stone-800">Find Item</strong> beside any ingredient to search for it directly on Instacart.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-200/80 bg-stone-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto sm:flex-col sm:items-start">
            <span className="text-[11px] text-stone-500">
              Ready for {selectedStore.name}
            </span>
            <span className="text-sm font-semibold text-stone-900">
              {includedItems.length} items (${totalPrice.toFixed(2)})
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopyList}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-xs transition-colors shrink-0"
              title="Copy formatted ingredient checklist to clipboard"
            >
              {copied ? (
                <>
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>Copy List</span>
                </>
              )}
            </button>

            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95 shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Open {selectedStore.name}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
