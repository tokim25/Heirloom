import React from 'react';
import { BookOpen, ShoppingBag, Plus, Sparkles } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'cookbook' | 'groceries';
  setActiveTab: (tab: 'cookbook' | 'groceries') => void;
  onOpenImport: () => void;
  onOpenChat: () => void;
  recipeCount: number;
  groceryPendingCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenImport,
  onOpenChat,
  recipeCount,
  groceryPendingCount,
}) => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF9F5]/95 backdrop-blur-2xl border-t border-stone-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-safe transition-all"
    >
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-between gap-1">
        {/* Cookbook Tab */}
        <button
          onClick={() => setActiveTab('cookbook')}
          className="flex-1 flex flex-col items-center justify-center py-1 group active:scale-95 transition-all"
        >
          <div
            className={`w-12 h-8 rounded-full flex items-center justify-center relative transition-all ${
              activeTab === 'cookbook'
                ? 'bg-stone-900 text-amber-400 shadow-sm ring-2 ring-stone-900/10'
                : 'bg-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100'
            }`}
          >
            <BookOpen
              className={`w-5 h-5 shrink-0 transition-transform ${
                activeTab === 'cookbook'
                  ? 'text-amber-400 stroke-[2.2]'
                  : 'text-stone-400 stroke-[1.8]'
              }`}
            />
            {recipeCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 text-[9px] font-mono px-1 rounded-full font-bold ${
                  activeTab === 'cookbook'
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {recipeCount}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] tracking-tight mt-1 transition-colors ${
              activeTab === 'cookbook'
                ? 'font-bold text-stone-950'
                : 'font-medium text-stone-500'
            }`}
          >
            Cookbook
          </span>
        </button>

        {/* Center Quick Action: Import / Add Recipe */}
        <button
          onClick={onOpenImport}
          className="flex-1 flex flex-col items-center justify-center py-1 group active:scale-95 transition-all"
          title="Import Recipe from URL, PDF, or Photo"
        >
          <div className="w-12 h-8 rounded-full bg-stone-100 border border-stone-200/90 text-stone-800 flex items-center justify-center shadow-2xs group-hover:bg-stone-200 group-hover:border-stone-300 transition-all">
            <Plus className="w-5 h-5 shrink-0 stroke-[2.5] text-stone-800" />
          </div>
          <span className="text-[10px] font-semibold text-stone-700 tracking-tight mt-1">
            Import
          </span>
        </button>

        {/* Groceries Tab */}
        <button
          onClick={() => setActiveTab('groceries')}
          className="flex-1 flex flex-col items-center justify-center py-1 group active:scale-95 transition-all"
        >
          <div
            className={`w-12 h-8 rounded-full flex items-center justify-center relative transition-all ${
              activeTab === 'groceries'
                ? 'bg-stone-900 text-amber-400 shadow-sm ring-2 ring-stone-900/10'
                : 'bg-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100'
            }`}
          >
            <ShoppingBag
              className={`w-5 h-5 shrink-0 transition-transform ${
                activeTab === 'groceries'
                  ? 'text-amber-400 stroke-[2.2]'
                  : 'text-stone-400 stroke-[1.8]'
              }`}
            />
            {groceryPendingCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-600 text-white font-bold animate-pulse shadow-xs">
                {groceryPendingCount}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] tracking-tight mt-1 transition-colors ${
              activeTab === 'groceries'
                ? 'font-bold text-stone-950'
                : 'font-medium text-stone-500'
            }`}
          >
            Groceries
          </span>
        </button>

        {/* Chef AI Quick Chat */}
        <button
          onClick={onOpenChat}
          className="flex-1 flex flex-col items-center justify-center py-1 group active:scale-95 transition-all"
          title="Ask Chef AI"
        >
          <div className="w-12 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 flex items-center justify-center shadow-2xs group-hover:bg-amber-500/25 group-hover:border-amber-500/40 transition-all">
            <Sparkles className="w-5 h-5 shrink-0 text-amber-600 fill-amber-500/25 stroke-[1.8]" />
          </div>
          <span className="text-[10px] font-semibold text-amber-900 tracking-tight mt-1">
            Chef AI
          </span>
        </button>
      </div>
    </nav>
  );
};
