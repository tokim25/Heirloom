import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  ShoppingBag,
  Plus,
  Sparkles,
  User as UserIcon,
  Calculator,
  UtensilsCrossed,
  Download,
  MoreHorizontal,
  ChevronDown,
  Cloud,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface NavbarProps {
  activeTab: 'cookbook' | 'groceries';
  setActiveTab: (tab: 'cookbook' | 'groceries') => void;
  onOpenImport: () => void;
  onOpenConverter: () => void;
  onOpenChat: () => void;
  onOpenPantry: () => void;
  onOpenDriveBackup?: () => void;
  onOpenIngredientOrganizer?: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
  recipeCount: number;
  groceryPendingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenImport,
  onOpenConverter,
  onOpenChat,
  onOpenPantry,
  onOpenDriveBackup,
  onOpenIngredientOrganizer,
  canInstallPwa,
  onInstallPwa,
  recipeCount,
  groceryPendingCount,
}) => {
  const { user, setIsProfileOpen, isGoogleConnected, isGoogleSignedIn } = useAuth();
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Close tools dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF9F5]/95 backdrop-blur-xl border-b border-stone-200/70 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-3">
        {/* Brand & Section Switcher (Desktop) */}
        <div className="flex items-center gap-4 md:gap-8 min-w-0">
          <div
            onClick={() => setActiveTab('cookbook')}
            className="cursor-pointer flex items-center gap-2.5 group select-none shrink-0"
          >
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs border border-stone-200/80 bg-stone-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img src="/icons/icon.svg" alt="Heirloom" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-2xl sm:text-3xl tracking-tight text-stone-900 group-hover:text-stone-700 transition-colors">
                  Heirloom
                </span>
                <span className="text-[10px] uppercase tracking-wider text-amber-800 font-bold px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 hidden sm:inline">
                  Recipes
                </span>
              </div>
              <span className="text-[10px] text-stone-500 font-medium hidden lg:inline tracking-tight -mt-0.5">
                Preserve the recipe. Share the table.
              </span>
            </div>
          </div>

          {/* Desktop Navigation Segments */}
          <nav className="hidden lg:flex items-center gap-1 bg-stone-200/60 p-1 rounded-2xl border border-stone-200/70 shadow-inner">
            <button
              onClick={() => setActiveTab('cookbook')}
              className={`group flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-xl transition-all ${
                activeTab === 'cookbook'
                  ? 'bg-white text-stone-950 font-semibold shadow-xs border border-stone-200/80'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
              }`}
            >
              <BookOpen
                className={`w-4 h-4 shrink-0 transition-colors ${
                  activeTab === 'cookbook'
                    ? 'text-amber-600 stroke-[2.2]'
                    : 'text-stone-400 group-hover:text-stone-600 stroke-[1.8]'
                }`}
              />
              <span>Cookbook</span>
              <span
                className={`text-[11px] font-mono transition-colors ${
                  activeTab === 'cookbook'
                    ? 'text-amber-900 font-bold'
                    : 'text-stone-400'
                }`}
              >
                ({recipeCount})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('groceries')}
              className={`group flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-xl transition-all ${
                activeTab === 'groceries'
                  ? 'bg-white text-stone-950 font-semibold shadow-xs border border-stone-200/80'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50 font-medium'
              }`}
            >
              <ShoppingBag
                className={`w-4 h-4 shrink-0 transition-colors ${
                  activeTab === 'groceries'
                    ? 'text-amber-600 stroke-[2.2]'
                    : 'text-stone-400 group-hover:text-stone-600 stroke-[1.8]'
                }`}
              />
              <span>Shared Groceries</span>
              {groceryPendingCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold transition-colors ${
                    activeTab === 'groceries'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-300 text-stone-700'
                  }`}
                >
                  {groceryPendingCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Ask Chef AI (Desktop - on mobile it lives in the thumb-accessible bottom bar) */}
          <button
            onClick={onOpenChat}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl transition-all active:scale-[0.98] shadow-xs"
            title="Chat with Chef AI (Find recipes, fix formatting, grocery help)"
          >
            <Sparkles className="w-4 h-4 text-amber-600 fill-amber-500/30 shrink-0" />
            <span>Ask Chef AI</span>
          </button>

          {/* Import Recipe (Desktop - on mobile it is the prominent center action in bottom bar) */}
          <button
            onClick={onOpenImport}
            className="hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0 text-white" />
            <span>Import Recipe</span>
          </button>

          {/* Unified Studio Tools Dropdown */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              className={`p-2 rounded-xl border shadow-xs transition-all active:scale-[0.97] ${
                isToolsMenuOpen
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-200/80 hover:bg-stone-50'
              }`}
              title="Studio Tools & Settings"
            >
              <MoreHorizontal
                className={`w-4 h-4 shrink-0 ${
                  isToolsMenuOpen ? 'text-white' : 'text-stone-600'
                }`}
              />
            </button>

            {isToolsMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-stone-200/80 py-2 z-50 animate-in fade-in duration-100">
                <div className="px-3.5 py-2 border-b border-stone-100 text-[11px] font-semibold tracking-wider uppercase text-stone-600">
                  Tools & Settings
                </div>

                <div className="py-1">
                  {onOpenDriveBackup && (
                    <button
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenDriveBackup();
                      }}
                      className="w-full px-3.5 py-2 text-xs text-left text-stone-800 hover:bg-stone-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Cloud className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">Google Drive Copy</span>
                        <span className="text-[10px] text-stone-600 truncate">Automatic copy of your cookbook</span>
                      </div>
                    </button>
                  )}

                  {onOpenIngredientOrganizer && (
                    <button
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onOpenIngredientOrganizer();
                      }}
                      className="w-full px-3.5 py-2 text-xs text-left text-stone-800 hover:bg-stone-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">Organize by Ingredient</span>
                        <span className="text-[10px] text-stone-600 truncate">Instant reverse index by ingredient</span>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      onOpenPantry();
                    }}
                    className="w-full px-3.5 py-2 text-xs text-left text-stone-800 hover:bg-stone-50 flex items-center gap-2.5 transition-colors"
                  >
                    <UtensilsCrossed className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium">Pantry Checklist</span>
                      <span className="text-[10px] text-stone-600 truncate">Track staples you already have</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsToolsMenuOpen(false);
                      onOpenConverter();
                    }}
                    className="w-full px-3.5 py-2 text-xs text-left text-stone-800 hover:bg-stone-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Calculator className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium">Culinary Converter</span>
                      <span className="text-[10px] text-stone-600 truncate">Cups to Grams, °F to °C</span>
                    </div>
                  </button>

                  {canInstallPwa && onInstallPwa && (
                    <button
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        onInstallPwa();
                      }}
                      className="w-full px-3.5 py-2 text-xs text-left text-stone-800 hover:bg-stone-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Download className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">Install Offline App</span>
                        <span className="text-[10px] text-stone-600 truncate">Add to Home Screen / Desktop</span>
                      </div>
                    </button>
                  )}
                </div>

              </div>
            )}
          </div>

          {!isGoogleSignedIn && (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-900 hover:bg-stone-800 text-white shadow-xs transition-all active:scale-[0.98]"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* User Profile Avatar */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-stone-200/60 transition-colors shrink-0"
            title={isGoogleSignedIn ? 'Account & Household Settings' : 'Sign In or Account Settings'}
          >
            <div className="relative">
              {isGoogleSignedIn && user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-stone-300"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-stone-700">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border-2 border-white rounded-full ${
                  isGoogleSignedIn ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
