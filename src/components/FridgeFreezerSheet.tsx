import React, { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { PlannedMeal, StockItem, StockPlace } from '../types/recipe.ts';
import { dayLabel, slotLabel, slotOf, toDateKey } from '../utils/mealPlan.ts';
import { Sheet } from './ui/Sheet.tsx';

const PLACES: { value: StockPlace; label: string }[] = [
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
];

export interface StockDraft {
  name: string;
  place: StockPlace;
  mealId: string | null;
}

interface FridgeFreezerSheetProps {
  items: StockItem[];
  meals: PlannedMeal[];
  onAdd: (draft: StockDraft) => void;
  onUpdate: (item: StockItem, draft: StockDraft) => void;
  /** The item was used up (or thrown out), so it leaves the list. */
  onUsed: (item: StockItem) => void;
  onClose: () => void;
}

/** What is in the fridge and freezer, shared with the household. An item can point at the meal it is for. */
export const FridgeFreezerSheet: React.FC<FridgeFreezerSheetProps> = ({ items, meals, onAdd, onUpdate, onUsed, onClose }) => {
  const today = toDateKey(new Date());
  const upcoming = meals.filter((m) => m.date >= today);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [name, setName] = useState('');
  const [place, setPlace] = useState<StockPlace>('freezer');
  const [mealId, setMealId] = useState('');

  const mealFor = (item: StockItem) => meals.find((m) => m.id === item.mealId);

  const reset = () => {
    setEditing(null);
    setName('');
    setMealId('');
  };
  const startEdit = (item: StockItem) => {
    setEditing(item);
    setName(item.name);
    setPlace(item.place);
    // A link to a meal that is gone or already past is not offered, so it clears on save.
    setMealId(upcoming.some((m) => m.id === item.mealId) ? item.mealId! : '');
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const draft: StockDraft = { name: name.trim(), place, mealId: mealId || null };
    if (editing) onUpdate(editing, draft);
    else onAdd(draft);
    reset();
  };

  return (
    <Sheet open onClose={onClose} title="Fridge & freezer" description="What you have on hand. Link an item to a meal to get a thaw reminder." size="md" fullOnMobile>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-stone-100/70 p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chicken breast, about 2 lb"
          aria-label="Item"
          className="min-h-12 px-3 rounded-xl border border-stone-300 bg-surface text-base"
        />
        <div role="radiogroup" aria-label="Where" className="flex items-center gap-2">
          {PLACES.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={place === p.value}
              onClick={() => setPlace(p.value)}
              className={`min-h-11 px-4 rounded-full border text-sm font-semibold transition-colors ${
                place === p.value ? 'bg-ink text-white border-ink' : 'bg-surface border-stone-300 text-stone-800 hover:bg-stone-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={mealId}
          onChange={(e) => setMealId(e.target.value)}
          aria-label="Linked meal"
          className="min-h-12 px-3 rounded-xl border border-stone-300 bg-surface text-base"
        >
          <option value="">Not linked to a meal</option>
          {upcoming.map((m) => (
            <option key={m.id} value={m.id}>
              {dayLabel(m.date, today)} · {slotLabel(slotOf(m))} · {m.recipeTitle}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-12 px-5 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-50 text-white text-base font-semibold inline-flex items-center gap-2"
          >
            {!editing && <Plus className="w-4 h-4" aria-hidden="true" />}
            {editing ? 'Save' : 'Add'}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="min-h-11 px-4 text-sm font-semibold text-stone-700 hover:text-stone-950 rounded-xl">
              Cancel
            </button>
          )}
        </div>
      </form>

      {PLACES.map((p) => {
        const here = items.filter((i) => i.place === p.value);
        return (
          <section key={p.value} aria-label={p.label}>
            <h3 className="text-sm font-semibold text-stone-900">{p.label}</h3>
            {here.length === 0 ? (
              <p className="text-sm text-stone-500 py-2">Nothing in the {p.label.toLowerCase()}.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-stone-200">
                {here.map((item) => {
                  const meal = mealFor(item);
                  return (
                    <li key={item.id} className="py-2 flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base text-stone-900">{item.name}</span>
                        {meal && (
                          <span className="block text-sm text-stone-600">
                            For {dayLabel(meal.date, today)} · {meal.recipeTitle}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label={`Edit ${item.name}`}
                        className="hit-area min-h-11 min-w-11 flex items-center justify-center rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onUsed(item)}
                        aria-label={`${item.name} used`}
                        className="min-h-11 px-4 rounded-xl border border-stone-300 bg-surface text-sm font-semibold text-stone-900 hover:bg-stone-50"
                      >
                        Used
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </Sheet>
  );
};
