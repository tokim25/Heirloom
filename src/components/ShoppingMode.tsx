import React, { useMemo, useState } from 'react';
import { Check, ClipboardCopy, ExternalLink, Loader2, Plus, RefreshCw, Share2 } from 'lucide-react';
import { GroceryItem, GroceryList, PantryItem } from '../types/recipe.ts';
import { Sheet } from './ui/Sheet.tsx';
import { apiFetch } from '../utils/api.ts';
import { describeQuantity, formatGroceryList, groupByAisle } from '../utils/groceryText.ts';
import { isIngredientInPantry } from '../utils/pantryDefaults.ts';
import {
  INSTACART_STORES_NEAR_YOU_URL,
  STORE_NAMES,
  visibleStoreNames,
  instacartSearchUrl,
  instacartStoreUrl,
  resolveStore,
  storeNotice,
} from '../utils/storeOptions.ts';

interface ShoppingModeProps {
  list: GroceryList;
  defaultStore?: string;
  pantryItems?: PantryItem[];
  /** Stores the person added because Instacart shows them in their area. */
  customStores?: string[];
  hiddenStores?: string[];
  onAddCustomStore: (name: string) => void;
  onSetHiddenStores: (names: string[]) => void;
  onToggleItem: (item: GroceryItem) => void;
  onRenameItem: (item: GroceryItem, name: string) => void;
  onStoreChange: (storeName: string) => void;
  onClose: () => void;
}

interface Suggestion {
  name: string;
  ratio: string;
  reason: string;
}

/**
 * Instacart does not let a third-party app fill a cart, so this makes the manual route quick: search
 * each item in your store, add it on Instacart, then tick it off here. Ticking checks it off the shared
 * list, so a partner sees it too.
 */
export const ShoppingMode: React.FC<ShoppingModeProps> = ({
  list,
  defaultStore,
  pantryItems = [],
  customStores = [],
  hiddenStores = [],
  onAddCustomStore,
  onSetHiddenStores,
  onToggleItem,
  onRenameItem,
  onStoreChange,
  onClose,
}) => {
  const [storeName, setStoreName] = useState(() => resolveStore(list.store || defaultStore).name);
  const store = useMemo(() => resolveStore(storeName), [storeName]);
  const [copied, setCopied] = useState(false);
  const [showPantry, setShowPantry] = useState(false);
  const [addingStore, setAddingStore] = useState(false);
  const [managingStores, setManagingStores] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | 'loading' | 'none'>>({});

  const total = list.items.length;
  const bought = list.items.filter((item) => item.checked).length;
  const remaining = list.items.filter((item) => !item.checked);
  const inPantry = remaining.filter((item) => isIngredientInPantry(item.name, pantryItems));
  const toBuy = remaining.filter((item) => !inPantry.includes(item));
  const doneItems = list.items.filter((item) => item.checked);

  const storeOptions = useMemo(() => visibleStoreNames(customStores, hiddenStores, storeName), [customStores, hiddenStores, storeName]);
  const notice = storeNotice(storeName);

  const submitNewStore = () => {
    const name = newStoreName.trim();
    if (!name) return;
    onAddCustomStore(name);
    setStoreName(name);
    setNewStoreName('');
    setAddingStore(false);
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const listText = () => formatGroceryList(list.title, store.name, list.items);

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(listText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const shareList = async () => {
    try {
      await navigator.share({ title: list.title, text: listText() });
    } catch {
      // The person closed the share sheet; nothing to report.
    }
  };

  const suggestSwap = async (item: GroceryItem) => {
    setSuggestions((prev) => ({ ...prev, [item.id]: 'loading' }));
    try {
      const res = await apiFetch('/api/recipes/substitute', {
        method: 'POST',
        body: JSON.stringify({
          ingredientName: item.name,
          unit: item.unit,
          amount: item.amount,
          recipeContext: item.recipeTitle || list.title,
          storeName: store.name,
        }),
      });
      const data = res.ok ? await res.json() : null;
      const top: Suggestion | undefined = data?.substitutions?.[0];
      setSuggestions((prev) => ({ ...prev, [item.id]: top ?? 'none' }));
    } catch {
      setSuggestions((prev) => ({ ...prev, [item.id]: 'none' }));
    }
  };

  const clearSuggestion = (id: string) =>
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const renderRow = (item: GroceryItem) => {
    const qty = describeQuantity(item);
    const suggestion = suggestions[item.id];
    return (
      <li key={item.id} className="py-2 flex items-start gap-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          aria-label={`${item.checked ? 'Put back' : 'Mark as added:'} ${item.name}`}
          onClick={() => onToggleItem(item)}
          className="min-h-11 min-w-11 -ml-2 flex items-center justify-center shrink-0"
        >
          <span
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
              item.checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 bg-surface'
            }`}
          >
            {item.checked && <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />}
          </span>
        </button>

        <div className="flex-1 min-w-0 py-2.5">
          <p className={`text-base leading-snug ${item.checked ? 'line-through text-stone-500' : 'text-stone-900'}`}>
            {qty && <span className="font-semibold">{qty} </span>}
            {item.name}
          </p>

          {!item.checked && suggestion === undefined && (
            <button
              type="button"
              onClick={() => suggestSwap(item)}
              className="mt-0.5 text-sm text-stone-600 hover:text-stone-900 underline underline-offset-2 min-h-8"
            >
              Not available? Suggest a swap
            </button>
          )}
          {suggestion === 'loading' && (
            <p className="mt-1 text-sm text-stone-600 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Finding a swap…
            </p>
          )}
          {suggestion === 'none' && (
            <p className="mt-1 text-sm text-stone-600">
              No swap found right now.{' '}
              <button type="button" className="underline" onClick={() => clearSuggestion(item.id)}>
                Dismiss
              </button>
            </p>
          )}
          {suggestion && suggestion !== 'loading' && suggestion !== 'none' && (
            <div className="mt-1.5 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/50 p-3 text-sm text-amber-900 dark:text-amber-100">
              <p className="font-semibold">{suggestion.name}</p>
              <p>{suggestion.ratio}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onRenameItem(item, suggestion.name);
                    clearSuggestion(item.id);
                  }}
                  className="min-h-11 px-4 rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-semibold"
                >
                  Use this
                </button>
                <button type="button" onClick={() => clearSuggestion(item.id)} className="min-h-11 px-3 text-sm font-semibold text-stone-700">
                  No thanks
                </button>
              </div>
            </div>
          )}
        </div>

        {!item.checked && (
          <a
            href={instacartSearchUrl(store, item.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 px-3.5 mt-0.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shrink-0"
            aria-label={`Find ${item.name} on Instacart at ${store.name}`}
          >
            Find
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        )}
      </li>
    );
  };

  const renderGroups = (items: GroceryItem[]) =>
    groupByAisle(items).map(({ aisle, items: group }) => (
      <section key={aisle} aria-label={aisle}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">{aisle}</h3>
        <ul className="divide-y divide-stone-100">{group.map(renderRow)}</ul>
      </section>
    ));

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Shop: ${list.title}`}
      description={`Find each item in ${store.name}, add it on Instacart, then tick it off here.`}
      size="xl"
      fullOnMobile
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover text-white text-base font-semibold"
        >
          Done
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-stone-700 flex-1 min-w-52">
          <span className="shrink-0">Store</span>
          <select
            value={storeName}
            onChange={(e) => {
              setStoreName(e.target.value);
              onStoreChange(e.target.value);
            }}
            className="flex-1 min-w-0 min-h-11 px-3 rounded-xl bg-surface border border-stone-300 text-sm font-medium text-stone-800"
          >
            {storeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <a
          href={instacartStoreUrl(store)}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 px-4 inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-surface hover:bg-stone-50 text-sm font-semibold text-stone-800"
        >
          Open {store.name}
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>

      {notice && (
        <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/50 p-3 text-sm text-rose-800 dark:text-rose-200">
          {notice}
        </p>
      )}

      <div className="text-sm text-stone-600 flex flex-col gap-1">
        <p>Which stores deliver to you depends on your address. Instacart shows yours when you are signed in.</p>
        <div className="flex flex-wrap items-center gap-x-4">
          <a
            href={INSTACART_STORES_NEAR_YOU_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 inline-flex items-center gap-1.5 font-semibold text-stone-800 underline underline-offset-2"
          >
            See stores near you on Instacart
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setManagingStores((v) => !v)}
            aria-expanded={managingStores}
            className="min-h-11 inline-flex items-center gap-1.5 font-semibold text-stone-800 underline underline-offset-2"
          >
            Choose my stores
          </button>
          {!addingStore && (
            <button
              type="button"
              onClick={() => setAddingStore(true)}
              className="min-h-11 inline-flex items-center gap-1.5 font-semibold text-stone-800 underline underline-offset-2"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add a store
            </button>
          )}
        </div>
        {managingStores && (
          <fieldset className="rounded-xl border border-stone-200 p-3">
            <legend className="px-1 text-sm font-semibold text-stone-800">Stores I can shop on Instacart</legend>
            <p className="text-sm text-stone-600 mb-1">Untick the ones that do not deliver to you and they will be hidden from the picker.</p>
            <ul>
              {[...STORE_NAMES, ...customStores.filter((n) => !STORE_NAMES.includes(n))].map((name) => {
                const shown = !hiddenStores.includes(name);
                return (
                  <li key={name}>
                    <label className="min-h-11 flex items-center gap-3 text-base text-stone-900">
                      <input
                        type="checkbox"
                        checked={shown}
                        onChange={() => onSetHiddenStores(shown ? [...hiddenStores, name] : hiddenStores.filter((n) => n !== name))}
                        className="w-5 h-5 accent-emerald-600"
                      />
                      {name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
        {addingStore && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitNewStore();
            }}
          >
            <label className="sr-only" htmlFor="new-store">
              Store name
            </label>
            <input
              id="new-store"
              autoFocus
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="Store name, for example Aldi"
              className="flex-1 min-w-0 min-h-11 px-3 rounded-xl bg-surface border border-stone-300 text-base text-stone-900"
            />
            <button type="submit" className="min-h-11 px-4 rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-semibold">
              Add
            </button>
            <button type="button" onClick={() => setAddingStore(false)} className="min-h-11 px-3 text-sm font-semibold text-stone-700">
              Cancel
            </button>
          </form>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm text-stone-700 mb-1.5">
          <span aria-live="polite">
            {bought} of {total} added
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={copyList}
              className="min-h-11 px-2 inline-flex items-center gap-1.5 font-semibold text-stone-700 hover:text-stone-950"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <ClipboardCopy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy list'}
            </button>
            {canShare && (
              <button
                type="button"
                onClick={shareList}
                className="min-h-11 px-2 inline-flex items-center gap-1.5 font-semibold text-stone-700 hover:text-stone-950"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                Share
              </button>
            )}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={bought}
          aria-label="Items added"
          className="h-2 rounded-full bg-stone-200 overflow-hidden"
        >
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${total ? (bought / total) * 100 : 0}%` }} />
        </div>
      </div>

      {remaining.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-serif text-2xl text-stone-900">Everything is added.</p>
          <p className="text-sm text-stone-600 mt-1">Head to Instacart to check out.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {renderGroups(toBuy)}

          {inPantry.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowPantry((v) => !v)}
                aria-expanded={showPantry}
                className="min-h-11 text-sm font-semibold text-stone-700 hover:text-stone-950 underline underline-offset-2 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                {showPantry ? 'Hide' : 'Show'} {inPantry.length} you probably have in your pantry
              </button>
              {showPantry && <div className="mt-2 flex flex-col gap-5">{renderGroups(inPantry)}</div>}
            </section>
          )}
        </div>
      )}

      {doneItems.length > 0 && (
        <section aria-label="Already added">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">Already added</h3>
          <ul className="divide-y divide-stone-100">{doneItems.map(renderRow)}</ul>
        </section>
      )}
    </Sheet>
  );
};
