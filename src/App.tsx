import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  BookOpen,
  ShoppingBag,
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
  CloudUpload,
  X,
} from 'lucide-react';
import { Recipe, GroceryList, GroceryItem } from './types/recipe.ts';
import { Navbar } from './components/Navbar.tsx';
import { RecipeCard } from './components/RecipeCard.tsx';
import { RecipeDetailModal, AddToGroceryListResult } from './components/RecipeDetailModal.tsx';
import { InstagramCookingMode } from './components/InstagramCookingMode.tsx';
import { RecipeImportModal } from './components/RecipeImportModal.tsx';
import { RecipeEditModal } from './components/RecipeEditModal.tsx';
import { InstacartModal } from './components/InstacartModal.tsx';
import { GroceryListView } from './components/GroceryListView.tsx';
import { UnitConverterModal } from './components/UnitConverterModal.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { GeminiChatModal } from './components/GeminiChatModal.tsx';
import { PantryModal } from './components/PantryModal.tsx';
import { GoogleDriveBackupModal } from './components/GoogleDriveBackupModal.tsx';
import { IngredientOrganizerModal } from './components/IngredientOrganizerModal.tsx';
import { googleDriveService, DriveAuthError, HeirloomDrivePayload } from './utils/googleDriveService.ts';
import { PantryItem } from './types/recipe.ts';
import { DEFAULT_PANTRY_ITEMS, isIngredientInPantry } from './utils/pantryDefaults.ts';
import { promptPwaInstall } from './utils/pwa.ts';
import { useAuth } from './context/AuthContext.tsx';
import { UnitSystem, scaleQuantity } from './utils/units.ts';
import { firestoreService, formatInviteCode } from './utils/firestoreService.ts';
import { closeOverlay, getPath, navigate, recipeIdFromPath, recipePath, usePath } from './utils/router.ts';
import { sounds } from './utils/sound.ts';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { PredictiveSearchBar } from './components/PredictiveSearchBar.tsx';
import { RecipeOrganizationToolbar } from './components/RecipeOrganizationToolbar.tsx';
import { Analytics } from '@vercel/analytics/react';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import {
  RecipeOrganizationFilter,
  INITIAL_ORGANIZATION_FILTER,
  matchRecipeFilters,
} from './utils/recipeTaxonomy.ts';
import { createRecipeSearchIndex } from './utils/searchEngine.ts';

export default function App() {
  const {
    user,
    isAuthLoading,
    isProfileOpen,
    setIsProfileOpen,
    isDriveModalOpen: isDriveBackupOpen,
    setIsDriveModalOpen: setIsDriveBackupOpen,
    isDriveCopyEnabled,
    googleAccessToken,
    markDriveTokenExpired,
    joinHousehold,
    household,
    signInWithGoogle,
    authErrorMessage,
  } = useAuth();
  // Screens follow the address bar: / (recipes), /groceries, /add, /profile, /r/:id
  const path = usePath();
  const [activeTab, setActiveTabState] = useState<'cookbook' | 'groceries'>(path === '/groceries' ? 'groceries' : 'cookbook');
  useEffect(() => {
    if (path === '/groceries') setActiveTabState('groceries');
    else if (path === '/') setActiveTabState('cookbook');
  }, [path]);
  const setActiveTab = (tab: 'cookbook' | 'groceries') => navigate(tab === 'groceries' ? '/groceries' : '/');
  const openImport = () => navigate('/add');
  const closeImport = () => closeOverlay('/add');
  const isImportOpen = path === '/add';

  // Recipes state & multi-dimensional taxonomy filter
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [organizationFilter, setOrganizationFilter] =
    useState<RecipeOrganizationFilter>(INITIAL_ORGANIZATION_FILTER);

  // Grocery state
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [currentListId, setCurrentListId] = useState<string>('');
  const [partnerNotification, setPartnerNotification] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [driveCopyStatus, setDriveCopyStatus] = useState<{ lastCopiedAt: string | null; error: string | null }>({
    lastCopiedAt: null,
    error: null,
  });

  const showNotice = (type: 'error' | 'success', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 5000);
  };

  // Modals state
  // The open recipe comes from /r/:id. `recipeFallback` covers the moment between saving a new
  // recipe and the cookbook listener delivering it.
  const [recipeFallback, setRecipeFallback] = useState<Recipe | null>(null);
  const [recipesLoaded, setRecipesLoaded] = useState(false);
  const routeRecipeId = recipeIdFromPath(path);
  const selectedRecipeDetail: Recipe | null = routeRecipeId
    ? recipes.find((r) => r.id === routeRecipeId) ?? (recipeFallback?.id === routeRecipeId ? recipeFallback : null)
    : null;
  const openRecipe = (recipe: Recipe) => navigate(recipePath(recipe.id));
  const closeRecipe = () => closeOverlay('/r');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [cookingState, setCookingState] = useState<{
    recipe: Recipe;
    servings: number;
    unitSystem: UnitSystem;
  } | null>(null);
  const [instacartModalState, setInstacartModalState] = useState<{
    recipe: Recipe;
    servings: number;
    initialStore?: string;
  } | null>(null);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPantryOpen, setIsPantryOpen] = useState(false);
  const [isIngredientOrganizerOpen, setIsIngredientOrganizerOpen] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(DEFAULT_PANTRY_ITEMS);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  // Listen for PWA install eligibility
  useEffect(() => {
    const handleCanInstall = () => setCanInstallPwa(true);
    window.addEventListener('can-install-pwa', handleCanInstall);
    return () => window.removeEventListener('can-install-pwa', handleCanInstall);
  }, []);

  // Firestore listeners: the cookbook and grocery lists for the user's household.
  useEffect(() => {
    const householdId = user?.householdId;
    if (!householdId) {
      setRecipes([]);
      setGroceryLists([]);
      setRecipesLoaded(false);
      return;
    }
    const reportListenerError = (what: string) => (err: Error) => {
      console.error(`${what} listener error:`, err);
      showNotice('error', `Could not load your ${what}. Check your connection; changes will sync when you're back online.`);
    };
    const unsubscribeRecipes = firestoreService.subscribeRecipes(
      householdId,
      (list) => {
        setRecipes(list);
        setRecipesLoaded(true);
      },
      reportListenerError('recipes')
    );
    const unsubscribeLists = firestoreService.subscribeGroceryLists(
      householdId,
      (lists) => {
        notifyPartnerActivity(previousListsRef.current, lists);
        previousListsRef.current = lists;
        setGroceryLists(lists);
      },
      reportListenerError('grocery lists')
    );
    return () => {
      unsubscribeRecipes();
      unsubscribeLists();
      previousListsRef.current = [];
    };
  }, [user?.householdId]);

  // Chime when someone else in the household checks an item off.
  const previousListsRef = useRef<GroceryList[]>([]);
  const notifyPartnerActivity = (prev: GroceryList[], next: GroceryList[]) => {
    if (prev.length === 0) return;
    const previousChecked = new Map<string, boolean>();
    prev.forEach((list) => list.items.forEach((item) => previousChecked.set(item.id, item.checked)));
    for (const list of next) {
      for (const item of list.items) {
        const wasChecked = previousChecked.get(item.id);
        if (item.checked && wasChecked === false && item.checkedBy && item.checkedBy !== user?.name) {
          sounds.playPartnerChime();
          setPartnerNotification(`${item.checkedBy} just checked off "${item.name}"`);
          window.setTimeout(() => setPartnerNotification(null), 4000);
          return;
        }
      }
    }
  };

  // Keep the one Drive file in step with the cookbook while Drive access is active.
  useEffect(() => {
    if (!isDriveCopyEnabled || !googleAccessToken || !user?.householdId) return;
    const timeoutId = window.setTimeout(async () => {
      try {
        await googleDriveService.writeLibrary(googleAccessToken, user.householdId, recipes, groceryLists);
        setDriveCopyStatus({ lastCopiedAt: new Date().toISOString(), error: null });
      } catch (err: any) {
        if (err instanceof DriveAuthError) markDriveTokenExpired();
        setDriveCopyStatus((prev) => ({ ...prev, error: err?.message || 'Google Drive copy failed.' }));
      }
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [recipes, groceryLists, isDriveCopyEnabled, googleAccessToken, user?.householdId]);

  // Lists are shared through the household, so its invite code and members apply to every list.
  const householdLists = useMemo(() => {
    const collaborators = Object.values(household?.members || {}).map((member, index) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      avatarUrl: member.avatarUrl,
      color: ['#1C1917', '#0284C7', '#A16207', '#047857'][index % 4],
      status: 'active' as const,
    }));
    const inviteCode = household?.inviteCode ? formatInviteCode(household.inviteCode) : '';
    return groceryLists.map((list) => ({ ...list, inviteCode, collaborators }));
  }, [groceryLists, household]);

  // Current active grocery list
  const currentGroceryList = useMemo(() => {
    return householdLists.find((l) => l.id === currentListId) || householdLists[0] || null;
  }, [householdLists, currentListId]);

  // Total pending grocery items across lists
  const groceryPendingCount = useMemo(() => {
    return groceryLists.reduce(
      (sum, l) => sum + l.items.filter((item) => !item.checked).length,
      0
    );
  }, [groceryLists]);

  // Writes apply locally right away (Firestore's cache fires the listener); a failure
  // is surfaced instead of silently leaving devices out of sync.
  const runWrite = (promise: Promise<unknown>, failureMessage: string) => {
    promise.catch((err) => {
      console.error(failureMessage, err);
      showNotice('error', failureMessage);
    });
  };

  const requireHousehold = () => {
    if (!user?.householdId) {
      showNotice('error', 'Sign in with Google to save recipes and lists.');
      return null;
    }
    return user.householdId;
  };

  // Index recipes for typo-tolerant fuzzy searching
  const fuseIndex = useMemo(() => createRecipeSearchIndex(recipes), [recipes]);

  // Filter and sort recipes with fuzzy search and multi-dimensional taxonomy
  const filteredRecipes = useMemo(() => {
    let list = recipes;

    const query = organizationFilter.searchQuery.trim();
    if (query) {
      const results = fuseIndex.search(query);
      list = results.map((r) => r.item);
    }

    list = list.filter((r) => matchRecipeFilters(r, organizationFilter));

    return [...list].sort((a, b) => {
      if (organizationFilter.sortBy === 'quickest') return a.totalTimeMinutes - b.totalTimeMinutes;
      if (organizationFilter.sortBy === 'prepTime') return a.prepTimeMinutes - b.prepTimeMinutes;
      if (organizationFilter.sortBy === 'alphabetical') return a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [recipes, organizationFilter, fuseIndex]);

  // A link to a recipe that is not in this cookbook (deleted, or another household's) goes home.
  useEffect(() => {
    if (routeRecipeId && user && recipesLoaded && !selectedRecipeDetail) {
      navigate('/', { replace: true });
      showNotice('error', "That recipe isn't in your cookbook.");
    }
  }, [routeRecipeId, user, recipesLoaded, selectedRecipeDetail]);

  // Recipe actions
  const handleRecipeImported = async (newRecipe: Recipe) => {
    const householdId = requireHousehold();
    if (!householdId) return;
    const pending = firestoreService.saveRecipe(householdId, newRecipe, user?.id);
    runWrite(pending, `"${newRecipe.title}" could not be saved. Try importing it again.`);
    const saved = { ...newRecipe, householdId };
    setRecipeFallback(saved);
    // Replace /add so Back does not return to an empty Add sheet.
    navigate(recipePath(saved.id), { replace: getPath() === '/add' });
    showNotice('success', `Saved "${newRecipe.title}" to your cookbook.`);
  };

  const handleSaveEditedRecipe = async (edited: Recipe) => {
    const householdId = requireHousehold();
    if (!householdId) throw new Error('Sign in with Google to save changes.');
    const saved = await firestoreService.saveRecipe(householdId, edited, user?.id);
    setRecipeFallback(saved);
    showNotice('success', `Saved changes to "${saved.title}".`);
  };

  const handleDeleteRecipe = async (id: string) => {
    const householdId = requireHousehold();
    if (!householdId) return;
    runWrite(firestoreService.deleteRecipe(householdId, id), 'That recipe could not be deleted. Try again.');
  };

  const handleRestoreFromDrive = async (payload: HeirloomDrivePayload) => {
    const householdId = requireHousehold();
    if (!householdId) return 0;
    const current = new Map(recipes.map((r) => [r.id, r]));
    const toRestore = (payload.recipes || []).filter((r) => {
      const existing = current.get(r.id);
      return !existing || (r.updatedAt || '') > (existing.updatedAt || '');
    });
    await Promise.all(toRestore.map((r) => firestoreService.saveRecipe(householdId, r, user?.id)));
    return toRestore.length;
  };

  const handleStartCooking = (recipe: Recipe, servings?: number, unitSystem?: UnitSystem) => {
    closeRecipe();
    setCookingState({
      recipe,
      servings: servings || recipe.defaultServings,
      unitSystem: unitSystem || 'imperial',
    });
  };

  const handleOpenInstacart = (recipe: Recipe, servings?: number, store?: string) => {
    setInstacartModalState({
      recipe,
      servings: servings || recipe.defaultServings,
      initialStore: store,
    });
  };

  // Add all recipe ingredients to a shared grocery list (creating one if needed)
  const handleAddRecipeToGroceryList = async (
    recipe: Recipe,
    servings: number = recipe.defaultServings,
    targetListId: string = currentListId
  ): Promise<AddToGroceryListResult> => {
    const householdId = requireHousehold();
    if (!householdId) {
      return { success: false, message: 'Sign in with Google to build a grocery list.' };
    }

    try {
      let targetList = groceryLists.find((list) => list.id === targetListId) || currentGroceryList;
      let listId = targetList?.id;
      let listTitle = targetList?.title || 'Groceries';
      if (!listId) {
        listId = await firestoreService.createGroceryList(householdId, 'Groceries', user?.preferredStore || '');
      }

      const itemsToAdd = recipe.ingredients.map((ing) => ({
        name: ing.name,
        amount: scaleQuantity(ing.amount, recipe.defaultServings, servings),
        unit: ing.unit,
        category: ing.category || 'Other',
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        assignedTo: 'Anyone',
        addedBy: user?.name || 'Collaborator',
      }));
      runWrite(
        firestoreService.addGroceryItems(householdId, listId, itemsToAdd),
        `Could not add ingredients to ${listTitle}. Try again.`
      );
      setCurrentListId(listId);
      return {
        success: true,
        listTitle,
        message: `Added ${itemsToAdd.length} ingredients to ${listTitle}.`,
      };
    } catch (err) {
      console.error('Failed to add recipe to grocery list:', err);
      return { success: false, message: 'Could not create a grocery list. Check your connection and try again.' };
    }
  };

  // Grocery item actions
  const handleUpdateGroceryItem = async (listId: string, itemId: string, updates: Partial<GroceryItem>) => {
    const householdId = requireHousehold();
    if (!householdId) return;
    const withActor: Partial<GroceryItem> = { ...updates };
    if (typeof updates.checked === 'boolean') {
      withActor.checkedBy = updates.checked ? user?.name || 'Someone' : undefined;
      withActor.checkedAt = updates.checked ? new Date().toISOString() : undefined;
    }
    runWrite(firestoreService.updateGroceryItem(householdId, listId, itemId, withActor), 'Could not update this item. Try again.');
  };

  const handleDeleteGroceryItem = async (listId: string, itemId: string) => {
    const householdId = requireHousehold();
    if (!householdId) return;
    runWrite(firestoreService.deleteGroceryItems(householdId, listId, [itemId]), 'Could not delete this item. Try again.');
  };

  const handleAddGroceryItem = async (listId: string, itemData: Partial<GroceryItem>) => {
    const householdId = requireHousehold();
    if (!householdId || !itemData.name) return;
    runWrite(
      firestoreService.addGroceryItems(householdId, listId, [
        {
          name: itemData.name,
          amount: itemData.amount ?? null,
          unit: itemData.unit || '',
          category: itemData.category || 'Other',
          assignedTo: itemData.assignedTo || 'Anyone',
          addedBy: user?.name || 'Collaborator',
          recipeId: itemData.recipeId,
          recipeTitle: itemData.recipeTitle,
        },
      ]),
      'Could not add this item. Try again.'
    );
  };

  const handleClearCompletedGroceries = async (listId: string) => {
    const householdId = requireHousehold();
    const list = groceryLists.find((l) => l.id === listId);
    if (!householdId || !list) return;
    const checkedIds = list.items.filter((i) => i.checked).map((i) => i.id);
    runWrite(firestoreService.deleteGroceryItems(householdId, listId, checkedIds), 'Could not clear completed items. Try again.');
  };

  const handleDeleteGroceryList = async (listId: string) => {
    const householdId = requireHousehold();
    if (!householdId) return;
    if (currentListId === listId) setCurrentListId('');
    runWrite(firestoreService.deleteGroceryList(householdId, listId), 'Could not delete that list. Try again.');
  };

  const handleCreateNewList = async (title: string, store: string) => {
    const householdId = requireHousehold();
    if (!householdId) return;
    try {
      const id = await firestoreService.createGroceryList(householdId, title, store);
      setCurrentListId(id);
    } catch (err) {
      console.error('Failed to create grocery list:', err);
      showNotice('error', 'Could not create this list. Check your connection and try again.');
    }
  };

  const handleJoinHousehold = async (code: string) => {
    try {
      await joinHousehold(code);
      showNotice('success', 'You joined the household. Recipes and lists are now shared.');
    } catch (err: any) {
      showNotice('error', err?.message || 'Could not join with that code. Check it and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-stone-900 flex flex-col selection:bg-stone-200 w-full max-w-full overflow-x-hidden">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={openImport}
        onOpenConverter={() => setIsConverterOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenPantry={() => setIsPantryOpen(true)}
        onOpenDriveBackup={() => setIsDriveBackupOpen(true)}
        onOpenIngredientOrganizer={() => setIsIngredientOrganizerOpen(true)}
        canInstallPwa={canInstallPwa}
        onInstallPwa={() => promptPwaInstall()}
        recipeCount={recipes.length}
        groceryPendingCount={groceryPendingCount}
      />

      {/* Main Content Body */}
      <main className="flex-1 pb-24 xl:pb-10 w-full max-w-full overflow-x-hidden">
        {isAuthLoading ? (
          <div className="flex justify-center py-32" aria-label="Loading your cookbook">
            <div className="h-8 w-8 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin" />
          </div>
        ) : !user ? (
          <WelcomeScreen onSignIn={signInWithGoogle} errorMessage={authErrorMessage} />
        ) : activeTab === 'cookbook' ? (
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col gap-6 sm:gap-8 w-full max-w-full">
            {/* Cookbook Header & Action Bar */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-stone-200/80">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl text-stone-900 tracking-tight">
                  Cookbook
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  {recipes.length} family recipes saved
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsIngredientOrganizerOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 hover:bg-stone-50 text-xs font-semibold shadow-2xs transition-all"
                >
                  <span>Organize by Ingredient</span>
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
                  onSelectRecipe={openRecipe}
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
                <h3 className="font-serif text-2xl text-stone-900">
                  {recipes.length === 0 ? 'Add your first recipe' : 'No matching recipes'}
                </h3>
                <p className="text-sm text-stone-600 mt-1 max-w-sm mx-auto">
                  {recipes.length === 0
                    ? 'Paste a link, snap a photo of a recipe card, or upload a PDF. Heirloom turns it into a clean, cookable recipe.'
                    : 'Try a different search, or clear the filters.'}
                </p>
                <button
                  onClick={openImport}
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
                    onSelect={openRecipe}
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
            groceryLists={householdLists}
            currentList={currentGroceryList}
            setCurrentList={(l) => setCurrentListId(l.id)}
            onUpdateItem={handleUpdateGroceryItem}
            onDeleteItem={handleDeleteGroceryItem}
            onAddItem={handleAddGroceryItem}
            onClearCompleted={handleClearCompletedGroceries}
            onCreateList={handleCreateNewList}
            onDeleteList={handleDeleteGroceryList}
            onJoinList={handleJoinHousehold}
            onOpenInstacartForList={(list) => {
              // Convert grocery list items into a temporary recipe format for Instacart shopping links
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
              handleOpenInstacart(fakeRecipe, 2, list.store);
            }}
            partnerNotification={partnerNotification}
            actionMessage={null}
            onDismissActionMessage={() => setNotice(null)}
            recipes={recipes}
          />
        )}
      </main>

      {/* Ergonomic Mobile Bottom Navigation for Thumb Reachability */}
      {user && (
      <MobileBottomNav recipeCount={recipes.length} groceryPendingCount={groceryPendingCount} />
      )}

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
          recipe={recipes.find((r) => r.id === selectedRecipeDetail.id) ?? selectedRecipeDetail}
          onEditRecipe={(r) => setEditingRecipe(r)}
          onClose={closeRecipe}
          onStartCooking={(r, s, u) => handleStartCooking(r, s, u)}
          onOpenInstacart={(r, s) => handleOpenInstacart(r, s)}
          onAddAllToGroceryList={(r, s) => handleAddRecipeToGroceryList(r, s)}
          groceryLists={groceryLists}
          currentListId={currentListId}
          onViewGroceryList={() => navigate('/groceries', { replace: true })}
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
          initialStore={instacartModalState.initialStore}
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

      {editingRecipe && (
        <RecipeEditModal
          recipe={editingRecipe}
          onSave={handleSaveEditedRecipe}
          onClose={() => setEditingRecipe(null)}
        />
      )}

      {user && isImportOpen && (
        <RecipeImportModal
          onClose={closeImport}
          onRecipeImported={handleRecipeImported}
          onAskChefAi={() => {
            closeImport();
            setIsChatOpen(true);
          }}
        />
      )}

      {isConverterOpen && (
        <UnitConverterModal onClose={() => setIsConverterOpen(false)} />
      )}

      {isProfileOpen && (
        <UserProfileModal
          onClose={() => setIsProfileOpen(false)}
          recipes={recipes}
          groceryLists={groceryLists}
          onOpenDriveBackup={() => setIsDriveBackupOpen(true)}
        />
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-4 right-4 bottom-24 xl:bottom-6 z-[60] mx-auto max-w-md rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3 text-sm ${
            notice.type === 'error' ? 'bg-rose-700 text-white' : 'bg-stone-900 text-white'
          }`}
        >
          <span className="flex-1 leading-snug">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="-m-1 p-1 rounded-full text-white/70 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Google Drive Vault & Cloud Backup Modal */}
      <GoogleDriveBackupModal
        isOpen={isDriveBackupOpen}
        onClose={() => setIsDriveBackupOpen(false)}
        copyStatus={driveCopyStatus}
        onRestore={handleRestoreFromDrive}
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
