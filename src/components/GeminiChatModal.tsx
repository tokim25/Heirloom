import React, { useState, useRef, useEffect } from 'react';
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
import { Recipe, GroceryItem } from '../types/recipe.ts';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsedRecipe?: Recipe;
  parsedGroceryItems?: Partial<GroceryItem>[];
  timestamp: string;
}

interface GeminiChatModalProps {
  onClose: () => void;
  onSaveRecipeToCookbook: (recipe: Recipe) => void;
  onAddGroceryItems: (items: Partial<GroceryItem>[]) => void;
  activeRecipe?: Recipe | null;
}

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
  activeRecipe,
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
  const [addedGroceryMsgIds, setAddedGroceryMsgIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Extract embedded JSON blocks from Gemini response
  const parseGeminiContent = (text: string) => {
    let cleanText = text;
    let parsedRecipe: Recipe | undefined;
    let parsedGroceryItems: Partial<GroceryItem>[] | undefined;

    // Check for ```recipe-json ... ```
    const recipeMatch = text.match(/```recipe-json\s*([\s\S]*?)\s*```/);
    if (recipeMatch) {
      try {
        const rawObj = JSON.parse(recipeMatch[1]);
        parsedRecipe = {
          id: `recipe-ai-${Date.now()}`,
          title: rawObj.title || 'Untitled Recipe',
          description: rawObj.description || '',
          cuisine: rawObj.cuisine || 'Continental',
          difficulty: rawObj.difficulty || 'Intermediate',
          prepTimeMinutes: rawObj.prepTimeMinutes || 15,
          cookTimeMinutes: rawObj.cookTimeMinutes || 20,
          totalTimeMinutes: (rawObj.prepTimeMinutes || 15) + (rawObj.cookTimeMinutes || 20),
          defaultServings: rawObj.defaultServings || 2,
          heroImage: rawObj.heroImage || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
          tags: rawObj.tags || ['Chef AI'],
          ingredients: (rawObj.ingredients || []).map((ing: any, i: number) => ({
            id: `ing-${Date.now()}-${i}`,
            name: ing.name || 'Ingredient',
            amount: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 1,
            unit: ing.unit || '',
            category: ing.category || 'Other',
            notes: ing.notes || '',
          })),
          steps: (rawObj.steps || []).map((st: any, i: number) => ({
            stepNumber: i + 1,
            title: st.title || `Step ${i + 1}`,
            instruction: st.instruction || '',
            timerSeconds: st.timerSeconds || 0,
            temperature: st.temperature || '',
            tips: st.tips || '',
          })),
          source: {
            type: 'manual',
            sourceName: 'Created with Gemini AI',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        cleanText = cleanText.replace(/```recipe-json[\s\S]*?```/, '').trim();
      } catch (e) {
        console.warn('Failed to parse recipe-json from Gemini:', e);
      }
    }

    // Check for ```grocery-json ... ```
    const groceryMatch = text.match(/```grocery-json\s*([\s\S]*?)\s*```/);
    if (groceryMatch) {
      try {
        const rawItems = JSON.parse(groceryMatch[1]);
        if (Array.isArray(rawItems)) {
          parsedGroceryItems = rawItems.map((item: any) => ({
            name: item.name,
            amount: item.amount || null,
            unit: item.unit || '',
            category: item.category || 'Other',
            assignedTo: 'Anyone',
          }));
        }
        cleanText = cleanText.replace(/```grocery-json[\s\S]*?```/, '').trim();
      } catch (e) {
        console.warn('Failed to parse grocery-json from Gemini:', e);
      }
    }

    return { cleanText, parsedRecipe, parsedGroceryItems };
  };

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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          context: activeRecipe
            ? { activeRecipeTitle: activeRecipe.title, servings: activeRecipe.defaultServings }
            : null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to communicate with Gemini');
      }

      const data = await res.json();
      const { cleanText, parsedRecipe, parsedGroceryItems } = parseGeminiContent(data.reply);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: cleanText,
        parsedRecipe,
        parsedGroceryItems,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: "I'm having a little trouble reaching the kitchen cloud right now. Please try asking again!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecipe = (recipe: Recipe) => {
    onSaveRecipeToCookbook(recipe);
    setAddedRecipeIds((prev) => new Set([...prev, recipe.id]));
  };

  const handleAddGroceries = (msgId: string, items: Partial<GroceryItem>[]) => {
    onAddGroceryItems(items);
    setAddedGroceryMsgIds((prev) => new Set([...prev, msgId]));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#FAF9F5] h-full shadow-2xl border-l border-stone-200 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Chat Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-white/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Chef Gemini AI
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
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
            const isRecipeAdded = m.parsedRecipe && addedRecipeIds.has(m.parsedRecipe.id);
            const isGroceriesAdded = addedGroceryMsgIds.has(m.id);

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-stone-900 text-white rounded-br-xs shadow-xs'
                      : 'bg-white text-stone-800 border border-stone-200/80 rounded-bl-xs shadow-xs'
                  }`}
                >
                  {/* Markdown content rendering */}
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

                  {/* Interactive Recipe Embed Box if Gemini provided one */}
                  {m.parsedRecipe && (
                    <div className="mt-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            Chef Recipe Generated
                          </span>
                          <h4 className="font-serif text-base text-stone-900 font-semibold mt-0.5">
                            {m.parsedRecipe.title}
                          </h4>
                          <p className="text-[11px] text-stone-600 mt-0.5">
                            {m.parsedRecipe.totalTimeMinutes}m total • {m.parsedRecipe.ingredients.length} ingredients • {m.parsedRecipe.difficulty}
                          </p>
                        </div>

                        {m.parsedRecipe.heroImage && (
                          <img
                            src={m.parsedRecipe.heroImage}
                            alt={m.parsedRecipe.title}
                            className="w-14 h-14 rounded-lg object-cover border border-amber-200 shrink-0"
                          />
                        )}
                      </div>

                      <button
                        onClick={() => handleSaveRecipe(m.parsedRecipe!)}
                        disabled={isRecipeAdded}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          isRecipeAdded
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-stone-900 hover:bg-stone-800 text-white shadow-xs active:scale-95'
                        }`}
                      >
                        {isRecipeAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Saved to Your Cookbook!</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Save to Minimalist Cookbook</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Interactive Grocery List Embed Box */}
                  {m.parsedGroceryItems && m.parsedGroceryItems.length > 0 && (
                    <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          Suggested Shopping Items ({m.parsedGroceryItems.length})
                        </span>
                        <ShoppingBag className="w-4 h-4 text-emerald-700" />
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
                            <span>Added to Shared Groceries!</span>
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

                <span className="text-[10px] text-stone-400 mt-1 px-1">
                  {m.timestamp}
                </span>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 p-3.5 bg-white border border-stone-200/80 rounded-2xl rounded-bl-xs w-fit text-xs text-stone-500 shadow-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>Chef Gemini is thinking…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-stone-100/70 border-t border-stone-200/80 overflow-x-auto no-scrollbar flex items-center gap-2">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 whitespace-nowrap shadow-xs transition-colors shrink-0"
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
          className="p-3 sm:p-4 bg-white border-t border-stone-200 flex items-center gap-2"
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
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold transition-all disabled:opacity-40 shadow-xs"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
