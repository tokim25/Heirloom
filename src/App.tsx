import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  BookOpen,
  ShoppingBag,
  Sparkles,
  Play,
  Calculator,
  Bug,
  Github,
  Filter,
  Flame,
  ChefHat,
  Compass,
  ArrowUpDown,
  UtensilsCrossed,
} from 'lucide-react';
import { Recipe, GroceryList, GroceryItem } from './types/recipe.ts';
import { Navbar } from './components/Navbar.tsx';
import { RecipeCard } from './components/RecipeCard.tsx';
import { RecipeDetailModal } from './components/RecipeDetailModal.tsx';
import { InstagramCookingMode } from './components/InstagramCookingMode.tsx';
import { RecipeImportModal } from './components/RecipeImportModal.tsx';
import { InstacartModal } from './components/InstacartModal.tsx';
import { GroceryListView } from './components/GroceryListView.tsx';
import { UnitConverterModal } from './components/UnitConverterModal.tsx';
import { BugReportModal } from './components/BugReportModal.tsx';
import { GitHubModal } from './components/GitHubModal.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { GeminiChatModal } from './components/GeminiChatModal.tsx';
import { PantryModal } from './components/PantryModal.tsx';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal.tsx';
import { IngredientOrganizerModal } from './components/IngredientOrganizerModal.tsx';
import { MiseBackupPayload } from './utils/googleDriveService.ts';
import { PantryItem } from './types/recipe.ts';
import { DEFAULT_PANTRY_ITEMS, isIngredientInPantry } from './utils/pantryDefaults.ts';
import { promptPwaInstall } from './utils/pwa.ts';
import { useAuth } from './context/AuthContext.tsx';
import { UnitSystem, scaleQuantity } from './utils/units.ts';
import { firestoreService } from './utils/firestoreService.ts';
import { sounds } from './utils/sound.ts';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { PredictiveSearchBar } from './components/PredictiveSearchBar.tsx';
import { RecipeOrganizationToolbar } from './components/RecipeOrganizationToolbar.tsx';
import { Analytics } from '@vercel/analytics/react';
import {
  RecipeOrganizationFilter,
  INITIAL_ORGANIZATION_FILTER,
  matchRecipeFilters,
} from './utils/recipeTaxonomy.ts';
import { createRecipeSearchIndex } from './utils/searchEngine.ts';

export default function App() {
  const { user, isProfileOpen, setIsProfileOpen } = useAuth();
  const [activeTab, setActiveTab] = useState<'cookbook' | 'groceries'>('cookbook');

  // Recipes state & multi-dimensional taxonomy filter
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [organizationFilter, setOrganizationFilter] =
    useState<RecipeOrganizationFilter>(INITIAL_ORGANIZATION_FILTER);

  // Grocery state
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [currentListId, setCurrentListId] = useState<string>('');
  const [partnerNotification, setPartnerNotification] = useState<string | null>(null);

  // Modals state
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<Recipe | null>(null);
  const [cookingState, setCookingState] = useState<{
    recipe: Recipe;
    servings: number;
    unitSystem: UnitSystem;
  } | null>(null);
  const [instacartModalState, setInstacartModalState] = useState<{
    recipe: Recipe;
    servings: number;
  } | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPantryOpen, setIsPantryOpen] = useState(false);
  const [isDriveBackupOpen, setIsDriveBackupOpen] = useState(false);
  const [isIngredientOrganizerOpen, setIsIngredientOrganizerOpen] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(DEFAULT_PANTRY_ITEMS);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  // Listen for PWA install eligibility
  useEffect(() => {
    const handleCanInstall = () => setCanInstallPwa(true);
    window.addEventListener('can-install-pwa', handleCanInstall);
    return () => window.removeEventListener('can-install-pwa', handleCanInstall);
  }, []);

  // Load initial recipes
  useEffect(() => {
    async function fetchRecipes() {
      try {
        const res = await fetch('/api/recipes');
        if (res.ok) {
          const data = await res.json();
          setRecipes(data.recipes || []);
        }
      } catch (err) {
        console.error('Failed to load recipes:', err);
      }
    }
    fetchRecipes();

    // Subscribe to real-time Firestore recipes
    const unsubscribe = firestoreService.subscribeRecipes((updatedList) => {
      if (updatedList.length > 0) {
        setRecipes(updatedList);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load initial grocery lists & subscribe to SSE real-time stream
  useEffect(() => {
    async function fetchLists() {
      try {
        let res = await fetch('/api/groceries');
        if (!res.ok) {
          res = await fetch('/api/grocery-lists');
        }
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          const lists = data.lists || [];
          if (Array.isArray(lists) && lists.length > 0) {
            setGroceryLists(lists);
            if (!currentListId) {
              setCurrentListId(lists[0].id);
            }
          }
        }
      } catch (err) {
        console.debug('Local grocery list state active:', err);
      }
    }
    fetchLists();

    // Connect to Server-Sent Events (SSE) for multi-device & partner live updates
    let eventSource: EventSource | null = null;
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        eventSource = new EventSource('/api/groceries/events');
        eventSource.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === 'ITEM_UPDATED') {
              const { listId, item, userName } = payload;
              if (!listId || !item) return;
              setGroceryLists((prev) =>
                prev.map((list) => {
                  if (list.id !== listId) return list;
                  return {
                    ...list,
                    items: list.items.map((i) => (i.id === item.id ? { ...i, ...item } : i)),
                  };
                })
              );

              // Play sound and trigger partner notification banner if checked
              if (item.checked && userName && userName !== (user?.name || 'Tokim')) {
                sounds.playPartnerChime();
                setPartnerNotification(`${userName} just checked off "${item.name}"!`);
                setTimeout(() => setPartnerNotification(null), 4000);
              }
            } else if (payload.type === 'ITEM_ADDED') {
              const { listId, item, payload: itemsPayload } = payload;
              const itemsToAdd = Array.isArray(itemsPayload) ? itemsPayload : item ? [item] : [];
              if (!listId || itemsToAdd.length === 0) return;
              setGroceryLists((prev) =>
                prev.map((list) => {
                  if (list.id !== listId) return list;
                  return { ...list, items: [...list.items, ...itemsToAdd] };
                })
              );
            } else if (payload.type === 'ITEM_DELETED') {
              const { listId, itemId } = payload;
              if (!listId || !itemId) return;
              setGroceryLists((prev) =>
                prev.map((list) => {
                  if (list.id !== listId) return list;
                  return { ...list, items: list.items.filter((i) => i.id !== itemId) };
                })
              );
            } else if (payload.type === 'COMPLETED_CLEARED') {
              const { listId } = payload;
              if (!listId) return;
              setGroceryLists((prev) =>
                prev.map((list) => {
                  if (list.id !== listId) return list;
                  return { ...list, items: list.items.filter((i) => !i.checked) };
                })
              );
            }
          } catch {
            // Heartbeat or non-JSON message
          }
        };

        eventSource.onerror = () => {
          // Silent fallback if SSE drops
        };
      }
    } catch (err) {
      console.warn('SSE subscription notice:', err);
    }

    // Also subscribe to Firestore grocery lists
    const unsubscribeFirestore = firestoreService.subscribeGroceryLists((lists) => {
      if (lists.length > 0) {
        setGroceryLists(lists);
      }
    });

    return () => {
      if (eventSource) eventSource.close();
      unsubscribeFirestore();
    };
  }, [user, currentListId]);

  // Current active grocery list
  const currentGroceryList = useMemo(() => {
    return groceryLists.find((l) => l.id === currentListId) || groceryLists[0] || null;
  }, [groceryLists, currentListId]);

  // Total pending grocery items across lists
  const groceryPendingCount = useMemo(() => {
    return groceryLists.reduce(
      (sum, l) => sum + l.items.filter((item) => !item.checked).length,
      0
    );
  }, [groceryLists]);

  // Index recipes for typo-tolerant fuzzy searching
  const fuseIndex = useMemo(() => createRecipeSearchIndex(recipes), [recipes]);

  // Filter and sort recipes with fuzzy search and multi-dimensional taxonomy
  const filteredRecipes = useMemo(() => {
    let list = recipes;

    // 1. Fuzzy search with typo tolerance (salmn -> salmon, spagetti -> spaghetti)
    const query = organizationFilter.searchQuery.trim();
    if (query) {
      const results = fuseIndex.search(query);
      list = results.map((r) => r.item);
    }

    // 2. Multi-dimensional taxonomy filters (cuisine, prep time, cooking duration, hero ingredient)
    list = list.filter((r) => matchRecipeFilters(r, organizationFilter));

    // 3. Sorting (newest, quickest cook time, fastest prep time, alphabetical)
    return [...list].sort((a, b) => {
      if (organizationFilter.sortBy === 'quickest') return a.totalTimeMinutes - b.totalTimeMinutes;
      if (organizationFilter.sortBy === 'prepTime') return a.prepTimeMinutes - b.prepTimeMinutes;
      if (organizationFilter.sortBy === 'alphabetical') return a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [recipes, organizationFilter, fuseIndex]);

  // Recipe actions
  const handleRecipeImported = async (newRecipe: Recipe) => {
    setRecipes((prev) => [newRecipe, ...prev]);
    setSelectedRecipeDetail(newRecipe);
    await firestoreService.saveRecipe(newRecipe);
  };

  const handleDeleteRecipe = async (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    await firestoreService.deleteRecipe(id);
  };

  const handleRestoreBackup = async (payload: MiseBackupPayload) => {
    if (payload.recipes && payload.recipes.length > 0) {
      // Merge restored recipes with existing ones
      const existingIds = new Set(recipes.map((r) => r.id));
      const merged = [...recipes];
      for (const r of payload.recipes) {
        if (!existingIds.has(r.id)) {
          merged.push(r);
        }
      }
      setRecipes(merged);
      for (const r of payload.recipes) {
        await firestoreService.saveRecipe(r);
      }
    }
    if (payload.groceryLists && payload.groceryLists.length > 0) {
      setGroceryLists(payload.groceryLists);
    }
    if (payload.pantryItems && payload.pantryItems.length > 0) {
      setPantryItems(payload.pantryItems);
    }
  };

  const handleStartCooking = (recipe: Recipe, servings?: number, unitSystem?: UnitSystem) => {
    setSelectedRecipeDetail(null);
    setCookingState({
      recipe,
      servings: servings || recipe.defaultServings,
      unitSystem: unitSystem || 'imperial',
    });
  };

  const handleOpenInstacart = (recipe: Recipe, servings?: number) => {
    setInstacartModalState({
      recipe,
      servings: servings || recipe.defaultServings,
    });
  };

  // Add all recipe ingredients to shared grocery list
  const handleAddRecipeToGroceryList = async (recipe: Recipe, servings: number = recipe.defaultServings) => {
    if (!currentGroceryList) return;

    try {
      const itemsToAdd = recipe.ingredients.map((ing) => {
        const scaled = scaleQuantity(ing.amount, recipe.defaultServings, servings);
        return {
          name: ing.name,
          amount: scaled,
          unit: ing.unit,
          category: ing.category || 'Other',
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          assignedTo: 'Anyone',
          addedBy: user?.name || 'Tokim',
        };
      });

      const res = await fetch(`/api/groceries/${currentGroceryList.id}/items/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd }),
      });

      if (res.ok) {
        const data = await res.json();
        setGroceryLists((prev) =>
          prev.map((l) => (l.id === data.list.id ? data.list : l))
        );
        firestoreService.saveGroceryList(data.list);
      }
    } catch (err) {
      console.error('Failed to add recipe to grocery list:', err);
    }
  };

  // Grocery item actions
  const handleUpdateGroceryItem = async (
    listId: string,
    itemId: string,
    updates: Partial<GroceryItem>
  ) => {
    try {
      const res = await fetch(`/api/groceries/${listId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          userName: user?.name || 'Tokim',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGroceryLists((prev) =>
          prev.map((l) => {
            if (l.id !== listId) return l;
            return {
              ...l,
              items: l.items.map((i) => (i.id === itemId ? data.item : i)),
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to update grocery item:', err);
    }
  };

  const handleDeleteGroceryItem = async (listId: string, itemId: string) => {
    try {
      await fetch(`/api/groceries/${listId}/items/${itemId}`, { method: 'DELETE' });
      setGroceryLists((prev) =>
        prev.map((l) => {
          if (l.id !== listId) return l;
          return {
            ...l,
            items: l.items.filter((i) => i.id !== itemId),
          };
        })
      );
    } catch (err) {
      console.error('Failed to delete grocery item:', err);
    }
  };

  const handleAddGroceryItem = async (listId: string, itemData: Partial<GroceryItem>) => {
    try {
      const res = await fetch(`/api/groceries/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
      if (res.ok) {
        const data = await res.json();
        setGroceryLists((prev) =>
          prev.map((l) => {
            if (l.id !== listId) return l;
            return {
              ...l,
              items: [...l.items, data.item],
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to add grocery item:', err);
    }
  };

  const handleClearCompletedGroceries = async (listId: string) => {
    try {
      await fetch(`/api/groceries/${listId}/completed`, { method: 'DELETE' });
      setGroceryLists((prev) =>
        prev.map((l) => {
          if (l.id !== listId) return l;
          return {
            ...l,
            items: l.items.filter((i) => !i.checked),
          };
        })
      );
    } catch (err) {
      console.error('Failed to clear completed items:', err);
    }
  };

  const handleCreateNewList = async (title: string, store: string) => {
    try {
      const res = await fetch('/api/groceries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, store }),
      });
      if (res.ok) {
        const data = await res.json();
        setGroceryLists((prev) => [data.list, ...prev]);
        setCurrentListId(data.list.id);
        firestoreService.saveGroceryList(data.list);
      }
    } catch (err) {
      console.error('Failed to create new grocery list:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-stone-900 flex flex-col selection:bg-stone-200 w-full max-w-full overflow-x-hidden">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenConverter={() => setIsConverterOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenPantry={() => setIsPantryOpen(true)}
        onOpenBugReport={() => setIsBugReportOpen(true)}
        onOpenGitHub={() => setIsGitHubOpen(true)}
        onOpenDriveBackup={() => setIsDriveBackupOpen(true)}
        onOpenIngredientOrganizer={() => setIsIngredientOrganizerOpen(true)}
        canInstallPwa={canInstallPwa}
        onInstallPwa={() => promptPwaInstall()}
        recipeCount={recipes.length}
        groceryPendingCount={groceryPendingCount}
      />

      {/* Main Content Body */}
      <main className="flex-1 pb-20 sm:pb-24 w-full max-w-full overflow-x-hidden">
        {activeTab === 'cookbook' ? (
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col gap-6 sm:gap-8 w-full max-w-full">
            {/* Editorial Hero Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 sm:pb-6 border-b border-stone-200/80">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                  Heirloom Archive
                </span>
                <h1 className="font-serif text-3xl sm:text-5xl text-stone-900 tracking-tight mt-1">
                  Heirloom
                </h1>
                <p className="text-xs sm:text-sm text-stone-600 mt-2 max-w-xl leading-relaxed">
                  Preserve the recipe. Share the table. Cook hands-free with voice navigation, organize by ingredients instantly, and back up securely to Google Drive.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <button
                  onClick={() => setIsIngredientOrganizerOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-800 hover:bg-stone-50 text-xs font-semibold shadow-2xs transition-all"
                >
                  <span>Organize by Ingredient</span>
                </button>
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all hover:shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Import Recipe</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </button>
              </div>
            </div>

            {/* Predictive Search & Multi-Dimensional Organization Toolbar */}
            <div className="flex flex-col gap-4 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <PredictiveSearchBar
                  searchQuery={organizationFilter.searchQuery}
                  setSearchQuery={(q) =>
                    setOrganizationFilter((prev) => ({ ...prev, searchQuery: q }))
                  }
                  recipes={recipes}
                  onSelectRecipe={(r) => setSelectedRecipeDetail(r)}
                  onSelectCuisine={(c) =>
                    setOrganizationFilter((prev) => ({ ...prev, cuisine: c }))
                  }
                  resultsCount={filteredRecipes.length}
                />
              </div>

              <RecipeOrganizationToolbar
                filter={organizationFilter}
                setFilter={setOrganizationFilter}
                recipes={recipes}
                totalFilteredCount={filteredRecipes.length}
                onOpenIngredientOrganizer={() => setIsIngredientOrganizerOpen(true)}
              />
            </div>

            {/* Recipes Grid */}
            {filteredRecipes.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-stone-200/80 p-8">
                <ChefHat className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="font-serif text-2xl text-stone-900">No matching recipes</h3>
                <p className="text-xs text-stone-600 mt-1 max-w-sm mx-auto">
                  Try adjusting your search terms, prep time, or cuisine filters.
                </p>
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import Recipe Now</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onSelect={(r) => setSelectedRecipeDetail(r)}
                    onStartCooking={(r) => handleStartCooking(r)}
                    onAddToGroceries={(r) => handleAddRecipeToGroceryList(r)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Shared Groceries Tab */
          <GroceryListView
            groceryLists={groceryLists}
            currentList={currentGroceryList}
            setCurrentList={(l) => setCurrentListId(l.id)}
            onUpdateItem={handleUpdateGroceryItem}
            onDeleteItem={handleDeleteGroceryItem}
            onAddItem={handleAddGroceryItem}
            onClearCompleted={handleClearCompletedGroceries}
            onCreateList={handleCreateNewList}
            onJoinList={(code) => alert(`Joined grocery list: ${code}`)}
            onOpenInstacartForList={(list) => {
              // Convert grocery list items into a temporary recipe format for Instacart cart modal
              const fakeRecipe: Recipe = {
                id: list.id,
                title: list.title,
                description: `Grocery order for ${list.title}`,
                defaultServings: 2,
                prepTimeMinutes: 0,
                cookTimeMinutes: 0,
                totalTimeMinutes: 0,
                cuisine: 'Pantry',
                difficulty: 'Easy',
                tags: ['Groceries'],
                heroImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
                ingredients: list.items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  amount: i.amount,
                  unit: i.unit,
                  category: i.category,
                  instacartQuery: i.name,
                  estimatedPrice: i.estimatedPrice,
                })),
                steps: [],
                source: { type: 'manual' },
                createdAt: list.createdAt,
                updatedAt: list.updatedAt,
              };
              handleOpenInstacart(fakeRecipe, 2);
            }}
            partnerNotification={partnerNotification}
            recipes={recipes}
          />
        )}
      </main>

      {/* Ambient Quick Action: Ask Chef AI (Desktop only, mobile accesses via bottom nav) */}
      <div className="hidden md:block fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsChatOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-stone-900/90 hover:bg-stone-900 text-white text-xs font-medium shadow-xl hover:shadow-2xl backdrop-blur-md transition-all active:scale-95 border border-white/10 group"
          title="Chat with Chef AI (Find recipes, fix formatting, grocery help)"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Ask Chef AI</span>
        </button>
      </div>

      {/* Ergonomic Mobile Bottom Navigation for Thumb Reachability */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        recipeCount={recipes.length}
        groceryPendingCount={groceryPendingCount}
      />

      {/* Modals */}
      {isChatOpen && (
        <GeminiChatModal
          onClose={() => setIsChatOpen(false)}
          onSaveRecipeToCookbook={(recipe) => handleRecipeImported(recipe)}
          onAddGroceryItems={(items) => {
            if (currentGroceryList) {
              items.forEach((item) => handleAddGroceryItem(currentGroceryList.id, item));
            }
          }}
          activeRecipe={selectedRecipeDetail}
        />
      )}

      {selectedRecipeDetail && (
        <RecipeDetailModal
          recipe={selectedRecipeDetail}
          onClose={() => setSelectedRecipeDetail(null)}
          onStartCooking={(r, s, u) => handleStartCooking(r, s, u)}
          onOpenInstacart={(r, s) => handleOpenInstacart(r, s)}
          onAddAllToGroceryList={(r, s) => handleAddRecipeToGroceryList(r, s)}
          onDeleteRecipe={(id) => handleDeleteRecipe(id)}
        />
      )}

      {cookingState && (
        <InstagramCookingMode
          recipe={cookingState.recipe}
          servings={cookingState.servings}
          unitSystem={cookingState.unitSystem}
          onClose={() => setCookingState(null)}
        />
      )}

      {instacartModalState && (
        <InstacartModal
          recipe={instacartModalState.recipe}
          servings={instacartModalState.servings}
          onClose={() => setInstacartModalState(null)}
          pantryItems={pantryItems}
        />
      )}

      {isPantryOpen && (
        <PantryModal
          onClose={() => setIsPantryOpen(false)}
          pantryItems={pantryItems}
          onToggleItem={(id) => {
            setPantryItems((prev) =>
              prev.map((i) => (i.id === id ? { ...i, inStock: !i.inStock } : i))
            );
          }}
          onAddItem={(name, category) => {
            const newItem: PantryItem = {
              id: `pantry-custom-${Date.now()}`,
              name,
              category,
              inStock: true,
            };
            setPantryItems((prev) => [newItem, ...prev]);
          }}
          onResetDefaults={() => setPantryItems(DEFAULT_PANTRY_ITEMS)}
        />
      )}

      {isImportOpen && (
        <RecipeImportModal
          onClose={() => setIsImportOpen(false)}
          onRecipeImported={handleRecipeImported}
        />
      )}

      {isConverterOpen && (
        <UnitConverterModal onClose={() => setIsConverterOpen(false)} />
      )}

      {isBugReportOpen && (
        <BugReportModal onClose={() => setIsBugReportOpen(false)} />
      )}

      {isGitHubOpen && (
        <GitHubModal
          onClose={() => setIsGitHubOpen(false)}
          onOpenBugReport={() => setIsBugReportOpen(true)}
        />
      )}

      {isProfileOpen && (
        <UserProfileModal
          onClose={() => setIsProfileOpen(false)}
          recipes={recipes}
          onOpenDriveBackup={() => setIsDriveBackupOpen(true)}
        />
      )}

      {/* Google Drive Vault & Cloud Backup Modal */}
      <GoogleDriveBackupModal
        isOpen={isDriveBackupOpen}
        onClose={() => setIsDriveBackupOpen(false)}
        recipes={recipes}
        groceryLists={groceryLists}
        pantryItems={pantryItems}
        onRestoreBackup={handleRestoreBackup}
      />

      {/* Organize By Ingredient Fast Inverted Index Modal */}
      <IngredientOrganizerModal
        isOpen={isIngredientOrganizerOpen}
        onClose={() => setIsIngredientOrganizerOpen(false)}
        recipes={recipes}
        filter={organizationFilter}
        setFilter={setOrganizationFilter}
      />

      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  );
}
