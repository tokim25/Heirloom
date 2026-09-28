import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Check,
  Share2,
  Users,
  Copy,
  Trash2,
  Store,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Bell,
  CheckCircle2,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { GroceryList, GroceryItem, Recipe } from '../types/recipe.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { formatFraction } from '../utils/units.ts';
import { sounds } from '../utils/sound.ts';
import { predictGroceryItem, PredictiveGroceryItem } from '../utils/searchEngine.ts';
import { STORE_NAMES } from '../utils/storeOptions.ts';
import { ConfirmSheet } from './ui/Sheet.tsx';

interface GroceryListViewProps {
  groceryLists: GroceryList[];
  currentList: GroceryList | null;
  setCurrentList: (list: GroceryList) => void;
  onUpdateItem: (listId: string, itemId: string, updates: Partial<GroceryItem>) => void;
  onDeleteItem: (listId: string, itemId: string) => void;
  onAddItem: (listId: string, item: Partial<GroceryItem>) => void;
  onClearCompleted: (listId: string) => void;
  onCreateList: (title: string, store: string) => void;
  onJoinList: (inviteCode: string) => void;
  onOpenInstacartForList: (list: GroceryList) => void;
  onDeleteList: (listId: string) => void;
  partnerNotification: string | null;
  actionMessage?: { type: 'error' | 'success'; text: string } | null;
  onDismissActionMessage?: () => void;
  recipes?: Recipe[];
}

const AISLE_CATEGORIES = [
  'Produce',
  'Dairy & Refrigerated',
  'Meat & Seafood',
  'Pantry & Spices',
  'Bakery',
  'Frozen',
  'Other',
] as const;

export const GroceryListView: React.FC<GroceryListViewProps> = ({
  groceryLists,
  currentList,
  setCurrentList,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onClearCompleted,
  onCreateList,
  onJoinList,
  onOpenInstacartForList,
  onDeleteList,
  partnerNotification,
  actionMessage,
  onDismissActionMessage,
  recipes = [],
}) => {
  const { user } = useAuth();
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<string>('Produce');
  const [newItemAssignee, setNewItemAssignee] = useState<string>('Anyone');
  const [showPredictions, setShowPredictions] = useState(false);
  const [showQuickAddDetails, setShowQuickAddDetails] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [confirmingDeleteList, setConfirmingDeleteList] = useState(false);
  const [modalTab, setModalTab] = useState<'create' | 'join'>('create');
  const [newListTitle, setNewListTitle] = useState('');
  const [newListStore, setNewListStore] = useState(() => {
    return (
      user?.preferredStore ||
      (typeof window !== 'undefined' ? localStorage.getItem('heirloom_preferred_store') : null) ||
      'Whole Foods Market'
    );
  });

  useEffect(() => {
    if (user?.preferredStore) {
      setNewListStore(user.preferredStore);
    }
  }, [user?.preferredStore]);

  const assigneeOptions = React.useMemo(() => {
    const names = new Set<string>(['Anyone']);
    if (user?.name) names.add(user.name);
    currentList?.collaborators.forEach((collaborator) => {
      if (collaborator.name && collaborator.status !== 'pending') names.add(collaborator.name);
    });
    return Array.from(names);
  }, [currentList?.collaborators, user?.name]);

  useEffect(() => {
    if (!assigneeOptions.includes(newItemAssignee)) {
      setNewItemAssignee('Anyone');
    }
    if (filterAssignee !== 'all' && !assigneeOptions.includes(filterAssignee)) {
      setFilterAssignee('all');
    }
  }, [assigneeOptions, filterAssignee, newItemAssignee]);

  // Rendered from both the empty state and the main view.
  const newListModal = showNewListModal ? (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-stone-200">
            {/* Tabs */}
            <div className="flex rounded-xl bg-stone-100 p-1 mb-5">
              <button
                type="button"
                onClick={() => setModalTab('create')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  modalTab === 'create'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Create New List
              </button>
              <button
                type="button"
                onClick={() => setModalTab('join')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  modalTab === 'join'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Join with Code
              </button>
            </div>

            {modalTab === 'create' ? (
              <>
                <h3 className="font-serif text-2xl text-stone-900 mb-1">Create Grocery List</h3>
                <p className="text-xs text-stone-500 mb-4">
                  Give your shopping list a title and choose your preferred supermarket.
                </p>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-700">List Title</label>
                    <input
                      type="text"
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      placeholder="e.g. Dinner Party, Weekend Farmers Market"
                      className="w-full mt-1 px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-700">Supermarket</label>
                    <select
                      value={newListStore}
                      onChange={(e) => setNewListStore(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    >
                      {STORE_NAMES.map((store) => (
                        <option key={store} value={store}>
                          {store}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowNewListModal(false)}
                    className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (newListTitle.trim()) {
                        onCreateList(newListTitle.trim(), newListStore);
                        setShowNewListModal(false);
                        setNewListTitle('');
                      }
                    }}
                    className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl"
                  >
                    Create List
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-serif text-2xl text-stone-900 mb-1">Join a household</h3>
                <p className="text-xs text-stone-500 mb-4">
                  Enter the invite code from your partner or family. You'll share every recipe and grocery list, and your recipes come with you.
                </p>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-stone-700">Invite code</label>
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="HEIR-ABCD-EFGH"
                      className="w-full mt-1 px-3.5 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl uppercase tracking-wider"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowNewListModal(false)}
                    className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (joinCodeInput.trim()) {
                        onJoinList(joinCodeInput.trim());
                        setShowNewListModal(false);
                        setJoinCodeInput('');
                      }
                    }}
                    className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl"
                  >
                    Join household
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
  ) : null;

  if (!currentList) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <h3 className="font-serif text-2xl text-stone-800">No Grocery Lists Found</h3>
        <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
          Create a shared list with your family or partner to plan groceries together.
        </p>
        <button
          onClick={() => {
            setModalTab('create');
            setShowNewListModal(true);
          }}
          className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold"
        >
          Create First Grocery List
        </button>
        {newListModal}
      </div>
    );
  }

  const cleanInviteCode = (currentList.inviteCode || '').replace(/^MISE-/, 'HEIR-');

  const handleToggleCheck = (item: GroceryItem) => {
    sounds.playCheckTick();
    onUpdateItem(currentList.id, item.id, {
      checked: !item.checked,
    });
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(
      `Join my kitchen on Heirloom to share recipes and grocery lists.\nInvite code: ${cleanInviteCode}\nOpen https://heirloom.tonykim.io, then Groceries > + > Join with code.`
    );
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    onAddItem(currentList.id, {
      name: newItemName.trim(),
      amount: newItemAmount ? parseFloat(newItemAmount) : null,
      unit: newItemUnit.trim(),
      category: newItemCategory as unknown as GroceryItem['category'],
      assignedTo: newItemAssignee,
      addedBy: user?.name || 'Collaborator',
    });

    setNewItemName('');
    setNewItemAmount('');
    setNewItemUnit('');
    setShowPredictions(false);
    setShowQuickAddDetails(false);
  };

  // Predictive item auto-completion based on recipes & common kitchen staples
  const predictiveItems = React.useMemo(() => {
    return predictGroceryItem(newItemName, recipes);
  }, [newItemName, recipes]);

  const handleSelectPrediction = (pred: PredictiveGroceryItem) => {
    setNewItemName(pred.name);
    setNewItemCategory(pred.category);
    if (pred.unit && !newItemUnit) {
      setNewItemUnit(pred.unit);
    }
    setShowPredictions(false);
  };

  // Filter items
  const filteredItems = currentList.items.filter((item) => {
    if (filterAssignee !== 'all' && item.assignedTo !== filterAssignee) return false;
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    return true;
  });

  const pendingItems = filteredItems.filter((i) => !i.checked);
  const completedItems = filteredItems.filter((i) => i.checked);

  // Group pending by category
  const groupedPending = pendingItems.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Real-time Partner Activity Banner */}
      {partnerNotification && (
        <div className="sticky top-20 z-30 p-3.5 rounded-2xl bg-amber-500 text-stone-950 shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>{partnerNotification}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider bg-stone-950/15 px-2 py-0.5 rounded-full font-bold">
            Live Sync
          </span>
        </div>
      )}

      {actionMessage && (
        <div
          className={`sticky top-20 z-30 p-3.5 rounded-2xl border shadow-lg flex items-start justify-between gap-3 animate-in slide-in-from-top duration-300 ${
            actionMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-start gap-2 text-xs font-medium">
            {actionMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {actionMessage.type === 'error' ? 'Grocery update failed' : 'Grocery update saved'}
              </p>
              <p className="mt-0.5">{actionMessage.text}</p>
            </div>
          </div>
          {onDismissActionMessage && (
            <button
              type="button"
              onClick={onDismissActionMessage}
              className="text-xs font-semibold opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Shared Kitchen Cart
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Real-time multi-user sync connected" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-stone-900">
            {currentList.title}
          </h1>
          <p className="text-xs text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>Store: {currentList.store || 'Whole Foods Market'}</span>
            <span>•</span>
            <span>{pendingItems.length} items remaining to purchase</span>
            <span>•</span>
            <span className="font-mono text-[11px] text-stone-400" title="Heirloom List Code">
              Code: {cleanInviteCode}
            </span>
          </p>
        </div>

        {/* Collaborators & List Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {currentList.collaborators.length > 0 && (
            <div className="hidden sm:flex -space-x-2 mr-1" title={`${currentList.collaborators.length} household collaborators`}>
              {currentList.collaborators.slice(0, 4).map((collaborator) => (
                <div
                  key={collaborator.id || collaborator.email}
                  className={`w-8 h-8 rounded-full border-2 border-white bg-stone-200 flex items-center justify-center overflow-hidden text-[10px] font-bold text-stone-700 shadow-xs ${
                    collaborator.status === 'pending' ? 'opacity-60 ring-2 ring-amber-300/70' : ''
                  }`}
                  title={`${collaborator.name}${collaborator.status === 'pending' ? ' (pending invite)' : ''}`}
                >
                  {collaborator.avatarUrl ? (
                    <img src={collaborator.avatarUrl} alt={collaborator.name} className="w-full h-full object-cover" />
                  ) : (
                    collaborator.name.charAt(0).toUpperCase()
                  )}
                </div>
              ))}
            </div>
          )}

          {/* List Switcher dropdown */}
          <select
            value={currentList.id}
            onChange={(e) => {
              const target = groceryLists.find((l) => l.id === e.target.value);
              if (target) setCurrentList(target);
            }}
            className="px-3 py-2 text-xs font-medium bg-white border border-stone-200 rounded-xl shadow-xs text-stone-800 focus:outline-none"
          >
            {groceryLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} ({l.items.filter((i) => !i.checked).length})
              </option>
            ))}
          </select>

          {/* New List / Join List */}
          <button
            onClick={() => {
              setModalTab('create');
              setShowNewListModal(true);
            }}
            className="p-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 shadow-xs"
            title="Create or Join Grocery List"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Delete this list */}
          <button
            type="button"
            onClick={() => setConfirmingDeleteList(true)}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-white hover:bg-rose-50 border border-stone-200 text-stone-500 hover:text-rose-700 shadow-xs"
            aria-label={`Delete list ${currentList.title}`}
            title="Delete this list"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Share / Invite Code */}
          <button
            type="button"
            onClick={handleCopyInvite}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-700 shadow-xs transition-all active:scale-95"
            title={`Copy invite link and code (${cleanInviteCode}) for family & partner`}
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Invite Copied!</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-stone-500" />
                <span>Invite Family</span>
              </>
            )}
          </button>

          {/* Shop with Instacart */}
          <button
            onClick={() => onOpenInstacartForList(currentList)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Shop on Instacart</span>
          </button>
        </div>
      </div>

      {/* Quick Add Ingredient Bar */}
      <form
        onSubmit={handleAddNewItem}
        className="bg-white rounded-2xl p-2.5 sm:p-4 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center gap-2.5 w-full"
      >
        <div className="relative w-full sm:flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => {
                setNewItemName(e.target.value);
                setShowPredictions(true);
              }}
              onFocus={() => {
                if (newItemName.trim().length > 0) setShowPredictions(true);
              }}
              placeholder="Add grocery item..."
              className="w-full min-w-0 px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />

            <button
              type="submit"
              className="sm:hidden px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add</span>
            </button>
          </div>

          {/* Predictive item suggestions */}
          {showPredictions && newItemName.trim().length > 0 && predictiveItems.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 overflow-hidden divide-y divide-stone-100 max-h-56 overflow-y-auto">
              <div className="px-3 py-1 bg-stone-50/90 text-[10px] text-stone-500 font-medium flex items-center justify-between">
                <span>Suggested items</span>
                <span className="text-stone-400">Click to fill</span>
              </div>
              {predictiveItems.map((pred, i) => (
                <button
                  key={`${pred.name}-${i}`}
                  type="button"
                  onClick={() => handleSelectPrediction(pred)}
                  className="w-full px-3 py-2 text-left hover:bg-amber-50/60 flex items-center justify-between gap-2 transition-colors group"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-stone-900 group-hover:text-amber-900 truncate">
                      {pred.name}
                    </span>
                    {pred.recipeTitle && (
                      <span className="text-[10px] text-stone-400 truncate">
                        From: {pred.recipeTitle}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-md shrink-0">
                    {pred.category}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowQuickAddDetails((isOpen) => !isOpen)}
          className="sm:hidden self-start px-2 py-1 text-[11px] font-medium text-stone-500 hover:text-stone-800"
        >
          {showQuickAddDetails ? 'Hide options' : 'Qty, aisle, or assignee'}
        </button>

        <div
          className={`grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto ${
            showQuickAddDetails ? 'grid' : 'hidden sm:flex'
          }`}
        >
          <div className="flex items-center gap-1.5 col-span-1">
            <input
              type="number"
              step="any"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(e.target.value)}
              placeholder="Qty"
              className="w-14 sm:w-16 px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-center focus:outline-none"
            />
            <input
              type="text"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              placeholder="Unit"
              className="flex-1 sm:w-20 px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
            />
          </div>

          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            className="col-span-1 px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none"
          >
            {AISLE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={newItemAssignee}
            onChange={(e) => setNewItemAssignee(e.target.value)}
            className="col-span-1 sm:w-auto px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none"
            title="Assign task to family member to avoid duplicate purchases"
          >
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name === 'Anyone' ? 'Assign: Anyone' : name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="hidden sm:flex px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Add Item</span>
          </button>
        </div>
      </form>

      {/* Filter and Task Division Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600 w-full">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full max-w-full">
          <span className="hidden sm:inline font-medium text-stone-500 uppercase tracking-wider text-[10px] shrink-0">
            Assigned:
          </span>
          <button
            onClick={() => setFilterAssignee('all')}
            className={`px-3 py-1 rounded-lg shrink-0 transition-all ${
              filterAssignee === 'all'
                ? 'bg-stone-900 text-white font-medium shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            All Items ({currentList.items.length})
          </button>
          {assigneeOptions
            .filter((name) => name !== 'Anyone')
            .map((name) => (
              <button
                key={name}
                onClick={() => setFilterAssignee(name)}
                className={`px-3 py-1 rounded-lg shrink-0 transition-all ${
                  filterAssignee === name
                    ? 'bg-stone-900 text-white font-medium shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                {name === user?.name ? 'Me' : name} ({currentList.items.filter((i) => i.assignedTo === name).length})
              </button>
            ))}
        </div>

        {completedItems.length > 0 && (
          <button
            onClick={() => onClearCompleted(currentList.id)}
            className="flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 transition-colors shrink-0 self-end sm:self-auto"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Clear Completed ({completedItems.length})</span>
          </button>
        )}
      </div>

      {/* Main Items Display Organized by Supermarket Aisle */}
      <div className="flex flex-col gap-6">
        {Object.keys(groupedPending).length === 0 && completedItems.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-stone-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-serif text-xl text-stone-900">Your shopping list is all set!</h3>
            <p className="text-xs text-stone-500 mt-1">
              Add ingredients from your recipes or type new items above.
            </p>
          </div>
        ) : (
          Object.entries(groupedPending).map(([category, items]) => (
            <div key={category} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  {category} ({items.length})
                </h3>
              </div>

              <div className="divide-y divide-stone-100 bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
                {items.map((item) => {
                  const qty = formatFraction(item.amount);
                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 hover:bg-stone-50/70 transition-colors group min-w-0"
                    >
                      {/* Checkbox & Item Name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleCheck(item)}
                          className="w-5 h-5 shrink-0 rounded-md border-2 border-stone-300 hover:border-stone-900 flex items-center justify-center transition-all bg-white"
                          title="Check off item"
                        >
                          {item.checked && <Check className="w-3.5 h-3.5 text-stone-900 stroke-[3]" />}
                        </button>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            {qty && (
                              <span className="font-semibold text-stone-900 text-xs sm:text-sm shrink-0">
                                {qty} {item.unit}
                              </span>
                            )}
                            <span className="text-stone-800 text-xs sm:text-sm font-medium truncate">
                              {item.name}
                            </span>
                            {item.recipeTitle && (
                              <span className="text-[10px] text-stone-500 hidden md:inline shrink-0">
                                for {item.recipeTitle}
                              </span>
                            )}
                          </div>

                          {/* Substitution details if out of stock */}
                          {item.isOutOfStock && item.substitution && (
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] sm:text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 w-fit">
                              <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[220px] sm:max-w-none">
                                Sub: {item.substitution.name} ({item.substitution.ratio})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Meta: Assignee pill & Actions */}
                      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <span className="sm:hidden max-w-[78px] truncate text-[10px] font-medium px-2 py-1 rounded-lg bg-stone-100 border border-stone-200 text-stone-600">
                          {item.assignedTo === user?.name ? 'Me' : item.assignedTo}
                        </span>

                        <select
                          value={item.assignedTo}
                          onChange={(e) =>
                            onUpdateItem(currentList.id, item.id, {
                              assignedTo: e.target.value,
                            })
                          }
                          className="hidden sm:block text-[10px] sm:text-[11px] font-medium px-2 py-1 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 focus:outline-none"
                          title="Assign to partner or family"
                        >
                          {assigneeOptions.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => onDeleteItem(currentList.id, item.id)}
                          className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-stone-400 hover:text-rose-600 transition-all"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Completed / Checked Off Items Section */}
        {completedItems.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-1">
              Checked Off ({completedItems.length})
            </h3>
            <div className="divide-y divide-stone-100 bg-white/70 rounded-2xl border border-stone-200/60 opacity-60">
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-3.5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <button
                      onClick={() => handleToggleCheck(item)}
                      className="w-5 h-5 rounded-md bg-stone-900 text-white flex items-center justify-center transition-all"
                      title="Uncheck item"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                    <span className="line-through text-stone-500 text-sm">
                      {item.amount ? `${item.amount} ${item.unit} ` : ''}{item.name}
                    </span>
                    {item.checkedBy && (
                      <span className="text-[10px] text-stone-400 italic">
                        (checked by {item.checkedBy})
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onDeleteItem(currentList.id, item.id)}
                    className="p-1 text-stone-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {newListModal}
      <ConfirmSheet
        open={confirmingDeleteList}
        title={`Delete "${currentList.title}"?`}
        message={`This removes the list and its ${currentList.items.length} ${currentList.items.length === 1 ? 'item' : 'items'} for everyone in your household. This can't be undone.`}
        confirmLabel="Delete list"
        destructive
        onCancel={() => setConfirmingDeleteList(false)}
        onConfirm={() => {
          setConfirmingDeleteList(false);
          onDeleteList(currentList.id);
        }}
      />
    </div>
  );
};
