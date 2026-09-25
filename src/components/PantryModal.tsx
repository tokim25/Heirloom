import React, { useState } from 'react';
import {
  X,
  PackageCheck,
  Check,
  Plus,
  Search,
  Sparkles,
  Archive,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { PantryItem } from '../types/recipe.ts';

interface PantryModalProps {
  onClose: () => void;
  pantryItems: PantryItem[];
  onToggleItem: (id: string) => void;
  onAddItem: (name: string, category: PantryItem['category']) => void;
  onResetDefaults: () => void;
}

const CATEGORIES: PantryItem['category'][] = [
  'Oils & Vinegars',
  'Spices & Seasonings',
  'Baking & Grains',
  'Aromatics & Produce',
  'Dairy & Eggs',
  'Condiments & Sauces',
];

export const PantryModal: React.FC<PantryModalProps> = ({
  onClose,
  pantryItems,
  onToggleItem,
  onAddItem,
  onResetDefaults,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<PantryItem['category']>('Oils & Vinegars');

  const filteredItems = pantryItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const inStockCount = pantryItems.filter((i) => i.inStock).length;

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    onAddItem(newItemName.trim(), newItemCategory);
    setNewItemName('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 bg-white/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-900">
              <PackageCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Kitchen Inventory
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                  {inStockCount} of {pantryItems.length} In Stock
                </span>
              </div>
              <h2 className="font-serif text-2xl text-stone-900">
                Pantry Checklist & Kitchen Staples
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

        {/* Toolbar & Filters */}
        <div className="p-4 sm:px-6 bg-stone-50/70 border-b border-stone-200/80 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter pantry items..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                {cat.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Info banner */}
        <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-950 flex items-center justify-between">
          <p>
            💡 Items marked <strong>In Stock</strong> are automatically filtered out when sending recipes to your Instacart cart or shared grocery list.
          </p>
          <button
            onClick={onResetDefaults}
            className="flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 underline shrink-0 ml-2"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Staples</span>
          </button>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onToggleItem(item.id)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                item.inStock
                  ? 'bg-white border-emerald-300 shadow-xs'
                  : 'bg-stone-100/80 border-stone-200/80 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                    item.inStock
                      ? 'bg-emerald-600 text-white'
                      : 'border-2 border-stone-300 bg-white'
                  }`}
                >
                  {item.inStock && <Check className="w-4 h-4 stroke-[3]" />}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-stone-900 leading-tight">
                    {item.name}
                  </h4>
                  <span className="text-[10px] text-stone-500">
                    {item.category}
                  </span>
                </div>
              </div>

              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  item.inStock
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {item.inStock ? 'Have it' : 'Out'}
              </span>
            </div>
          ))}
        </div>

        {/* Add custom item form */}
        <form
          onSubmit={handleAddNew}
          className="p-4 bg-white border-t border-stone-200 flex flex-col sm:flex-row gap-2 items-center"
        >
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add new pantry staple (e.g. Dijon mustard, truffle salt)..."
            className="flex-1 w-full px-3.5 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
          />

          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </form>
      </div>
    </div>
  );
};
