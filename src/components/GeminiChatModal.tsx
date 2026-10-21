import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import {
  X,
  Sparkles,
  Send,
  ChefHat,
  ShoppingBag,
  BookOpen,
  Plus,
  Check,
  RotateCcw,
  Loader2,
  Wand2,
  ArrowRight,
  Flame,
  MessageSquare,
} from 'lucide-react';
import { Recipe, GroceryItem, StockItem, PlannedMeal, PantryItem } from '../types/recipe.ts';
import { buildKitchenContext } from '../utils/kitchenContext.ts';
import { toDateKey } from '../utils/mealPlan.ts';
import { readTextStream } from '../utils/chefStream.ts';
import { apiFetch } from '../utils/api.ts';
import { parseChatEmbeds } from '../utils/chatEmbeds.ts';
// The OpenUI renderer (~60 KB gz) loads only when a beta answer arrives.
const ChefAnswer = lazy(() => import('./chef/ChefAnswer.tsx'));
import { Sheet } from './ui/Sheet.tsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsedRecipes?: Recipe[];
  parsedGroceryItems?: Partial<GroceryItem>[];
  /** 'openui' when content is an OpenUI Lang answer drawn by ChefAnswer. */
  format?: 'openui';
  /** True while an OpenUI answer is still arriving. */
  streaming?: boolean;
  timestamp: string;
}

// Pilot switch for OpenUI answers, remembered on this device only.
const BETA_KEY = 'heirloom_chef_answers_beta';
const readBeta = () => {
  try {
    return localStorage.getItem(BETA_KEY) === '1';
  } catch {
    return false;
  }
};

interface GeminiChatModalProps {
  onClose: () => void;
  onSaveRecipeToCookbook: (recipe: Recipe) => void | Promise<void>;
  onAddGroceryItems: (items: Partial<GroceryItem>[]) => void;
  /** Saves the recipe (if needed) and opens it in Stories Mode. */
  onCookRecipe?: (recipe: Recipe) => void;
  activeRecipe?: Recipe | null;
  /** The household's kitchen, sent with beta answers so Chef can suggest from it. */
  recipes?: Recipe[];
  stockItems?: StockItem[];
  plannedMeals?: PlannedMeal[];
  pantryItems?: PantryItem[];
}

const TONIGHT_PROMPT = 'What can we make tonight?';

const QUICK_PROMPTS = [
  '⚡ Give me 3 recipes with under 15 minutes of prep time',
  '🐟 Healthy seafood dinner using wild salmon and fresh herbs',
  '⏱️ 20-minute weeknight dinner with pantry staples',
  '🍝 Authentic Italian pasta with under 30 mins total time',
  '🥬 High-protein vegetarian grain bowl with chickpeas',
];

export const GeminiChatModal: React.FC<GeminiChatModalProps> = ({
  onClose,
  onSaveRecipeToCookbook,
  onAddGroceryItems,
  onCookRecipe,
  activeRecipe,
  recipes = [],
  stockItems = [],
  plannedMeals = [],
  pantryItems = [],
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your **Heirloom Chef & Culinary Companion**, powered by Google Gemini.\n\nI can help you organize and craft recipes structured across your kitchen's core dimensions:\n- **Ingredients**: Recipes tailored to specific proteins (seafood, poultry, vegetarian) or exact ingredients in your pantry\n- **Prep Time**: Recipes with express hands-on preparation (≤ 15 minutes)\n- **Cooking Duration**: Quick 20-min meals vs. slow-simmered weekend roasts\n- **Cuisine**: Authentic regional traditions (Italian, Japanese, Mediterranean, Mexican)\n\nWhat are we cooking or planning today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [addedRecipeIds, setAddedRecipeIds] = useState<Set<string>>(new Set());
  const [savingRecipeIds, setSavingRecipeIds] = useState<Set<string>>(new Set());
  const [recipeSaveErrors, setRecipeSaveErrors] = useState<Record<string, string>>({});
  const [addedGroceryMsgIds, setAddedGroceryMsgIds] = useState<Set<string>>(new Set());
  const [betaAnswers, setBetaAnswers] = useState(readBeta);
  /** Read out by screen readers once an answer is complete. */
  const [announcement, setAnnouncement] = useState('');
  const toggleBeta = () => {
    const next = !betaAnswers;
    setBetaAnswers(next);
    try {
      localStorage.setItem(BETA_KEY, next ? '1' : '0');
    } catch {
      // Private mode: the switch still works for this visit.
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const context = betaAnswers
      ? {
          ...(activeRecipe ? { activeRecipeTitle: activeRecipe.title, servings: activeRecipe.defaultServings } : {}),
          ...buildKitchenContext(recipes, stockItems, plannedMeals, pantryItems, toDateKey(new Date())),
        }
      : activeRecipe
      ? { activeRecipeTitle: activeRecipe.title, servings: activeRecipe.defaultServings }
      : null;
    const ask = async (format?: 'openui') => {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          context,
          ...(format ? { format } : {}),
        }),
      });
      if (!res.ok) throw new Error('Failed to communicate with Gemini');
      return res;
    };
    const botId = `bot-${Date.now()}`;
    const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const markdownMessage = async (): Promise<Message> => {
      const data = await (await ask()).json();
      const { cleanText, recipes, groceryItems } = parseChatEmbeds(data.reply);
      return { id: botId, role: 'assistant', content: cleanText, parsedRecipes: recipes, parsedGroceryItems: groceryItems, timestamp: stamp() };
    };
    const putMessage = (msg: Message) =>
      setMessages((prev) => (prev.some((m) => m.id === botId) ? prev.map((m) => (m.id === botId ? msg : m)) : [...prev, msg]));
    setAnnouncement('');

    try {
      if (betaAnswers) {
        // Beta: the answer streams in as OpenUI Lang. If it doesn't pass the checks once complete,
        // the same turn is asked again as a normal markdown answer, which replaces it.
        const res = await ask('openui');
        let text = '';
        if (res.body) {
          const timestamp = stamp();
          text = await readTextStream(res.body, (soFar) =>
            putMessage({ id: botId, role: 'assistant', content: soFar, format: 'openui', streaming: true, timestamp }),
          ).catch(() => '');
        }
        const { checkChefAnswer } = await import('../utils/chefLibrary.ts');
        const cookbookIds = new Set(context && 'cookbook' in context ? context.cookbook.map((r) => r.id) : []);
        if (checkChefAnswer(text, cookbookIds).ok) {
          putMessage({ id: botId, role: 'assistant', content: text, format: 'openui', timestamp: stamp() });
        } else {
          putMessage(await markdownMessage());
        }
      } else {
        putMessage(await markdownMessage());
      }
      setAnnouncement('Chef answered.');
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: "I'm having a little trouble reaching the kitchen cloud right now. Please try asking again!",
        timestamp: stamp(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== botId || !m.streaming), errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecipe = async (recipe: Recipe) => {
    setSavingRecipeIds((prev) => new Set([...prev, recipe.id]));
    setRecipeSaveErrors((prev) => {
      const next = { ...prev };
      delete next[recipe.id];
      return next;
    });

    try {
      await onSaveRecipeToCookbook(recipe);
      setAddedRecipeIds((prev) => new Set([...prev, recipe.id]));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save this recipe. Please try again.';
      setRecipeSaveErrors((prev) => ({ ...prev, [recipe.id]: message }));
    } finally {
      setSavingRecipeIds((prev) => {
        const next = new Set(prev);
        next.delete(recipe.id);
        return next;
      });
    }
  };

  const handleAddGroceries = (msgId: string, items: Partial<GroceryItem>[]) => {
    onAddGroceryItems(items);
    setAddedGroceryMsgIds((prev) => new Set([...prev, msgId]));
  };

  return (
    <Sheet open onClose={onClose} title="Chef AI chat" variant="bare" size="xl" placement="right">
        {/* Chat Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-surface/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-on-accent flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                  Chef Gemini AI
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold dark:bg-amber-900/40 dark:text-amber-100">
                  Gemini 3.8 Flash
                </span>
              </div>
              <h2 className="font-serif text-lg font-medium text-stone-900">
                Culinary Assistant & Planner
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleBeta}
              aria-pressed={betaAnswers}
              title="Try the new interactive answers on this device"
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                betaAnswers
                  ? 'bg-amber-500 border-amber-500 text-on-accent'
                  : 'border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100'
              }`}
            >
              Beta answers
            </button>
            <button
              onClick={() => {
                setMessages([
                  {
                    id: 'welcome-reset',
                    role: 'assistant',
                    content: "What new culinary idea or shopping task can I help you with?",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              title="Reset Conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors"
              title="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            const isGroceriesAdded = addedGroceryMsgIds.has(m.id);

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  aria-busy={m.streaming || undefined}
                  className={`${m.format === 'openui' ? 'w-full' : 'max-w-[85%] sm:max-w-[80%]'} rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-ink text-white rounded-br-xs shadow-xs'
                      : 'bg-surface text-stone-800 border border-stone-200/80 rounded-bl-xs shadow-xs'
                  }`}
                >
                  {m.format === 'openui' ? (
                    <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin text-stone-400" />}>
                    <ChefAnswer
                      response={m.content}
                      messageId={m.id}
                      savedIds={addedRecipeIds}
                      savingIds={savingRecipeIds}
                      saveErrors={recipeSaveErrors}
                      addedGroceryKeys={addedGroceryMsgIds}
                      cookbook={recipes}
                      isStreaming={!!m.streaming}
                      onSave={handleSaveRecipe}
                      onCook={onCookRecipe}
                      onAddGroceries={handleAddGroceries}
                      onAsk={(text) => handleSendMessage(text)}
                    />
                    </Suspense>
                  ) : (
                  /* Markdown content rendering */
                  <div className="whitespace-pre-wrap space-y-2">
                    {m.content.split('\n\n').map((paragraph, i) => (
                      <p key={i}>
                        {paragraph.split(/(\*\*.*?\*\*)/).map((chunk, j) => {
                          if (chunk.startsWith('**') && chunk.endsWith('**')) {
                            return (
                              <strong key={j} className="font-semibold text-stone-950">
                                {chunk.slice(2, -2)}
                              </strong>
                            );
                          }
                          return chunk;
                        })}
                      </p>
                    ))}
                  </div>
                  )}

                  {/* Interactive Recipe Embed Boxes, one per recipe Gemini provided */}
                  {m.parsedRecipes?.map((recipe) => {
                    const isRecipeAdded = addedRecipeIds.has(recipe.id);
                    const isRecipeSaving = savingRecipeIds.has(recipe.id);
                    const recipeSaveError = recipeSaveErrors[recipe.id];
                    return (
                    <div key={recipe.id} className="mt-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 flex flex-col gap-2.5 dark:bg-amber-950/40 dark:border-amber-800/50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                            Chef Recipe Generated
                          </span>
                          <h4 className="font-serif text-base text-stone-900 font-semibold mt-0.5">
                            {recipe.title}
                          </h4>
                          <p className="text-xs text-stone-600 mt-0.5">
                            {recipe.totalTimeMinutes}m total • {recipe.ingredients.length} ingredients • {recipe.difficulty}
                          </p>
                        </div>

                        {recipe.heroImage && (
                          <img
                            src={recipe.heroImage}
                            alt={recipe.title}
                            className="w-14 h-14 rounded-lg object-cover border border-amber-200 shrink-0 dark:border-amber-800/50"
                          />
                        )}
                      </div>

                      <button
                        onClick={() => handleSaveRecipe(recipe)}
                        disabled={isRecipeAdded || isRecipeSaving}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          isRecipeAdded
                            ? 'bg-emerald-600 text-white cursor-default'
                            : isRecipeSaving
                            ? 'bg-stone-500 text-white cursor-wait'
                            : 'bg-ink hover:bg-ink-hover text-white shadow-xs active:scale-95'
                        }`}
                      >
                        {isRecipeAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Saved to Your Cookbook!</span>
                          </>
                        ) : isRecipeSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving to Cookbook...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Save to Minimalist Cookbook</span>
                          </>
                        )}
                      </button>
                      {onCookRecipe && (
                        <button
                          onClick={() => onCookRecipe(recipe)}
                          disabled={isRecipeSaving}
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-surface text-stone-800 border border-stone-200 hover:bg-stone-100 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                        >
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>{isRecipeAdded ? 'Cook in Stories Mode' : 'Save & Cook in Stories Mode'}</span>
                        </button>
                      )}
                      {recipeSaveError && (
                        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50">
                          {recipeSaveError}
                        </div>
                      )}
                    </div>
                  );
                  })}

                  {/* Interactive Grocery List Embed Box */}
                  {m.parsedGroceryItems && m.parsedGroceryItems.length > 0 && (
                    <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex flex-col gap-2.5 dark:bg-emerald-950/40 dark:border-emerald-800/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                          Suggested Shopping Items ({m.parsedGroceryItems.length})
                        </span>
                        <ShoppingBag className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                      </div>

                      <ul className="text-xs text-stone-700 space-y-1">
                        {m.parsedGroceryItems.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>
                              {item.amount ? `${item.amount} ${item.unit} ` : ''}
                              <strong>{item.name}</strong> ({item.category})
                            </span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleAddGroceries(m.id, m.parsedGroceryItems!)}
                        disabled={isGroceriesAdded}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          isGroceriesAdded
                            ? 'bg-emerald-700 text-white cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-95'
                        }`}
                      >
                        {isGroceriesAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added to your grocery list</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Items to Grocery List</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-xs text-stone-400 mt-1 px-1">
                  {m.timestamp}
                </span>
              </div>
            );
          })}

          {isLoading && !messages.some((m) => m.streaming) && (
            <div className="flex items-center gap-2 p-3.5 bg-surface border border-stone-200/80 rounded-2xl rounded-bl-xs w-fit text-xs text-stone-500 shadow-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
              <span>Chef Gemini is thinking…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
          <p className="sr-only" aria-live="polite">{announcement}</p>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-stone-100/70 border-t border-stone-200/80 overflow-x-auto no-scrollbar flex items-center gap-2">
          {(betaAnswers ? [TONIGHT_PROMPT, ...QUICK_PROMPTS] : QUICK_PROMPTS).map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="text-xs px-3 py-1.5 rounded-full bg-surface hover:bg-stone-50 text-stone-700 border border-stone-200 whitespace-nowrap shadow-xs transition-colors shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-surface border-t border-stone-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini for recipes, fixes, or grocery plans..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-on-accent font-semibold transition-all disabled:opacity-40 shadow-xs"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
    </Sheet>
  );
};
