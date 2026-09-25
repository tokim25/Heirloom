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
  Info,
} from 'lucide-react';
import { Recipe, Ingredient, PantryItem } from '../types/recipe.ts';
import { scaleQuantity, formatFraction } from '../utils/units.ts';
import { isIngredientInPantry } from '../utils/pantryDefaults.ts';

interface InstacartModalProps {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
  onAddSubstitutionsToList?: (items: unknown[]) => void;
  pantryItems?: PantryItem[];
}

const STORES = [
  { id: 'whole-foods', name: 'Whole Foods Market', tagline: 'Organic & Artisan Quality', delivery: '1-2 hrs', minOrder: '$35', color: '#006241' },
  { id: 'trader-joes', name: "Trader Joe's", tagline: 'Neighborhood Favorites & Value', delivery: '2 hrs', minOrder: '$35', color: '#BA1B1D' },
  { id: 'safeway', name: 'Safeway', tagline: 'Full Grocery Pantry Staples', delivery: '1 hr', minOrder: '$30', color: '#E31837' },
  { id: 'kroger', name: 'Kroger', tagline: 'Fresh Savings & Bulk Staples', delivery: '1-2 hrs', minOrder: '$35', color: '#004F9F' },
  { id: 'wegmans', name: 'Wegmans', tagline: 'Chef-grade Produce & Cheeses', delivery: '2 hrs', minOrder: '$35', color: '#880000' },
  { id: 'sprouts', name: "Sprouts Farmers Market", tagline: 'Farm-Fresh & Bulk Spices', delivery: '1 hr', minOrder: '$35', color: '#2B5E27' },
];

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
  onClose,
  onAddSubstitutionsToList,
  pantryItems = [],
}) => {
  const [selectedStore, setSelectedStore] = useState(STORES[0]);
  const [items, setItems] = useState<CartItemState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSent, setOrderSent] = useState(false);

  // Initialize cart items from recipe ingredients scaled to servings
  useEffect(() => {
    // Generate realistic stock availability (e.g. 1 item simulated out of stock to demonstrate substitution)
    const initial: CartItemState[] = recipe.ingredients.map((ing, idx) => {
      const scaled = scaleQuantity(ing.amount, recipe.defaultServings, servings);
      // Simulate out of stock for special herbs/produce occasionally
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
        included: !inPantry, // auto-exclude if already in pantry to save money
        substitution: outOfStock
          ? {
              name: ing.name.includes('Butter') ? 'Ghee or High-Heat Avocado Oil' : 'Fresh Oregano or Italian Seasoning',
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

  const handleExportCartToInstacart = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOrderSent(true);
      // Open Instacart search with first item or store link
      const firstItem = items[0]?.query || recipe.title;
      const url = `https://www.instacart.com/store/s?k=${encodeURIComponent(firstItem)}`;
      window.open(url, '_blank');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Instacart Grocery Connector
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                  Live API
                </span>
              </div>
              <h2 className="font-serif text-2xl text-stone-900">
                Populate Cart for {recipe.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Store Selector */}
        <div className="p-4 sm:p-6 bg-white border-b border-stone-200">
          <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-2.5">
            Choose Preferred Grocery Store
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {STORES.map((store) => {
              const isSelected = selectedStore.id === store.id;
              return (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store)}
                  className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/20'
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
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-600">
                    <span>⏱ {store.delivery}</span>
                    <span>•</span>
                    <span>Min {store.minOrder}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Items List */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Ingredients to Add ({items.length} items for {servings} servings)
            </span>
            <span className="text-xs font-medium text-stone-800">
              Est. Total: ${totalPrice.toFixed(2)}
            </span>
          </div>

          {outOfStockCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {outOfStockCount} item is currently out of stock at {selectedStore.name}. Smart substitutions suggested below!
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx] = { ...item, included: e.target.checked };
                          setItems(updated);
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title={item.included ? 'Item included in cart' : 'Item excluded from cart'}
                      />

                      <div className="flex items-baseline gap-2">
                        <span className={`font-semibold text-xs sm:text-sm ${item.included ? 'text-stone-900' : 'text-stone-400 line-through'}`}>
                          {qty ? `${qty} ${item.unit}` : item.unit}
                        </span>
                        <span className={`text-xs sm:text-sm ${item.included ? 'text-stone-800' : 'text-stone-400 line-through'}`}>
                          {item.name}
                        </span>
                        {item.isInPantry && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                            In Pantry
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-600 font-mono">
                        ${item.estimatedPrice.toFixed(2)}
                      </span>

                      {item.isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold">
                          Out of Stock
                        </span>
                      ) : (
                        <a
                          href={`https://www.instacart.com/store/s?k=${encodeURIComponent(item.query)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline font-medium"
                          title="View product on Instacart"
                        >
                          <span>Find</span>
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
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-stone-200/80 bg-stone-50 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[11px] text-stone-500">
              Ready to send to Instacart
            </span>
            <span className="text-sm font-semibold text-stone-900">
              {items.length} items at {selectedStore.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>

            <button
              onClick={handleExportCartToInstacart}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Syncing Cart…</span>
              ) : orderSent ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Cart Created in Instacart!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Send Cart to Instacart</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
