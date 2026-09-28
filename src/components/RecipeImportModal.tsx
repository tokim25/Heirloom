import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Link2,
  FileText,
  Image as ImageIcon,
  Youtube,
  UploadCloud,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { Ingredient, Recipe, RecipeStep } from '../types/recipe.ts';

interface RecipeImportModalProps {
  onClose: () => void;
  onRecipeImported: (recipe: Recipe) => void | Promise<void>;
}

type TabType = 'link' | 'media' | 'youtube' | 'text';
type IngredientCategory = Ingredient['category'];

const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  'Produce',
  'Dairy & Refrigerated',
  'Meat & Seafood',
  'Pantry & Spices',
  'Bakery',
  'Frozen',
  'Other',
];

const parseNumberInput = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const IMPORT_TIMEOUT_MS = 45000;

export const RecipeImportModal: React.FC<RecipeImportModalProps> = ({
  onClose,
  onRecipeImported,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('link');
  const [urlInput, setUrlInput] = useState('');
  const [rawTextInput, setRawTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<Recipe | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      importAbortRef.current?.abort();
    };
  }, []);

  const reviewWarnings = parsedRecipe
    ? [
        !parsedRecipe.title.trim() ? 'Missing recipe title' : null,
        !parsedRecipe.heroImage.trim() ? 'Missing recipe image' : null,
        parsedRecipe.defaultServings <= 0 ? 'Servings need review' : null,
        parsedRecipe.ingredients.length === 0 ? 'No ingredients found' : null,
        parsedRecipe.steps.length === 0 ? 'No steps found' : null,
        parsedRecipe.ingredients.some((ing) => !ing.name.trim()) ? 'One or more ingredients need names' : null,
        parsedRecipe.steps.some((step) => !step.instruction.trim()) ? 'One or more steps need instructions' : null,
      ].filter(Boolean) as string[]
    : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setErrorMsg(null);

    // Read preview
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(selected);
  };

  const handleImport = async () => {
    setErrorMsg(null);
    setIsProcessing(true);
    importAbortRef.current?.abort();
    const abortController = new AbortController();
    importAbortRef.current = abortController;
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, IMPORT_TIMEOUT_MS);

    try {
      let payload: Record<string, unknown> = {};

      if (activeTab === 'link' || activeTab === 'youtube') {
        if (!urlInput.trim()) {
          throw new Error('Please enter a valid recipe or YouTube URL');
        }
        payload = { url: urlInput.trim() };
      } else if (activeTab === 'media') {
        if (!file || !filePreview) {
          throw new Error('Please select a photo, screenshot, or PDF file');
        }
        payload = {
          fileData: filePreview,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
        };
      } else if (activeTab === 'text') {
        if (!rawTextInput.trim()) {
          throw new Error('Please paste or type your recipe notes');
        }
        payload = { rawText: rawTextInput.trim() };
      }

      const res = await fetch('/api/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to curate recipe');
      }

      const data = await res.json();
      if (data.recipe) {
        setParsedRecipe(data.recipe);
      } else {
        throw new Error('No recipe content parsed');
      }
    } catch (err: unknown) {
      console.error('Import error:', err);
      const msg =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Recipe curation timed out or was stopped. Please try again, or paste the recipe text instead of uploading the full file.'
          : err instanceof Error
          ? err.message
          : 'Failed to import recipe';
      setErrorMsg(msg);
    } finally {
      window.clearTimeout(timeoutId);
      if (importAbortRef.current === abortController) {
        importAbortRef.current = null;
      }
      setIsProcessing(false);
    }
  };

  const handleStopImport = () => {
    importAbortRef.current?.abort();
  };

  const handleClose = () => {
    importAbortRef.current?.abort();
    onClose();
  };

  const handleSavePreview = async () => {
    if (!parsedRecipe) return;
    setErrorMsg(null);

    if (!parsedRecipe.title.trim()) {
      setErrorMsg('Please add a recipe title before saving.');
      return;
    }
    if (parsedRecipe.ingredients.length === 0 || parsedRecipe.steps.length === 0) {
      setErrorMsg('Please keep at least one ingredient and one step before saving.');
      return;
    }
    if (parsedRecipe.ingredients.some((ingredient) => !ingredient.name.trim())) {
      setErrorMsg('Please name every ingredient before saving, or remove blank ingredient rows.');
      return;
    }
    if (parsedRecipe.steps.some((step) => !step.instruction.trim())) {
      setErrorMsg('Please add instructions for every step before saving, or remove blank step rows.');
      return;
    }

    setIsProcessing(true);
    try {
      await onRecipeImported({
        ...parsedRecipe,
        title: parsedRecipe.title.trim(),
        description: parsedRecipe.description.trim(),
        cuisine: parsedRecipe.cuisine.trim() || 'Other',
        ingredients: parsedRecipe.ingredients.map((ing) => ({
          ...ing,
          name: ing.name.trim(),
          unit: ing.unit.trim(),
        })),
        steps: parsedRecipe.steps.map((step, index) => ({
          ...step,
          stepNumber: index + 1,
          title: step.title?.trim() || undefined,
          instruction: step.instruction.trim(),
        })),
        updatedAt: new Date().toISOString(),
      });
      handleClose();
    } catch (err: unknown) {
      console.error('Save imported recipe error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save recipe';
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateParsedRecipe = (updates: Partial<Recipe>) => {
    setParsedRecipe((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const updateIngredient = (index: number, updates: Partial<Ingredient>) => {
    setParsedRecipe((prev) => {
      if (!prev) return prev;
      const ingredients = [...prev.ingredients];
      ingredients[index] = { ...ingredients[index], ...updates };
      return { ...prev, ingredients };
    });
  };

  const updateStep = (index: number, updates: Partial<RecipeStep>) => {
    setParsedRecipe((prev) => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], ...updates };
      return { ...prev, steps };
    });
  };

  const removeIngredient = (index: number) => {
    setParsedRecipe((prev) =>
      prev ? { ...prev, ingredients: prev.ingredients.filter((_, idx) => idx !== index) } : prev
    );
  };

  const addIngredient = () => {
    setParsedRecipe((prev) =>
      prev
        ? {
            ...prev,
            ingredients: [
              ...prev.ingredients,
              {
                id: `imported-ingredient-${Date.now()}`,
                name: '',
                amount: null,
                unit: '',
                category: 'Other',
              },
            ],
          }
        : prev
    );
  };

  const removeStep = (index: number) => {
    setParsedRecipe((prev) =>
      prev
        ? {
            ...prev,
            steps: prev.steps
              .filter((_, idx) => idx !== index)
              .map((step, idx) => ({ ...step, stepNumber: idx + 1 })),
          }
        : prev
    );
  };

  const addStep = () => {
    setParsedRecipe((prev) =>
      prev
        ? {
            ...prev,
            steps: [
              ...prev.steps,
              {
                stepNumber: prev.steps.length + 1,
                title: '',
                instruction: '',
              },
            ],
          }
        : prev
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Curate & Standardize
            </span>
            <h2 className="font-serif text-2xl text-stone-900 mt-0.5">
              Import New Recipe
            </h2>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        {!parsedRecipe && (
        <div className="flex border-b border-stone-200 bg-stone-100/70 p-1.5 gap-1">
          <button
            onClick={() => {
              setActiveTab('link');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'link'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Web Link</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('youtube');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'youtube'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span>YouTube / Shorts</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('media');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'media'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo / PDF</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('text');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes / Text</span>
          </button>
        </div>
        )}

        {/* Tab Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedRecipe ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Review Before Saving
                  </span>
                  <h3 className="font-serif text-xl text-stone-900 mt-0.5">
                    Preview imported recipe
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Make quick corrections, then save it to your cookbook.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setParsedRecipe(null);
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Source</span>
                </button>
              </div>

              {reviewWarnings.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col gap-1.5">
                  <span className="font-semibold">Review needed</span>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewWarnings.map((warning) => (
                      <span
                        key={warning}
                        className="px-2 py-1 rounded-full bg-white border border-amber-200 font-medium"
                      >
                        {warning}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Title
                  </span>
                  <input
                    value={parsedRecipe.title}
                    onChange={(e) => updateParsedRecipe({ title: e.target.value })}
                    className={`px-3 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
                      parsedRecipe.title.trim() ? 'border-stone-300' : 'border-amber-400'
                    }`}
                  />
                </label>

                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Description
                  </span>
                  <textarea
                    rows={2}
                    value={parsedRecipe.description}
                    onChange={(e) => updateParsedRecipe({ description: e.target.value })}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>

                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Hero Image URL
                  </span>
                  <input
                    value={parsedRecipe.heroImage}
                    onChange={(e) => updateParsedRecipe({ heroImage: e.target.value })}
                    className={`px-3 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
                      parsedRecipe.heroImage.trim() ? 'border-stone-300' : 'border-amber-400'
                    }`}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Cuisine
                  </span>
                  <input
                    value={parsedRecipe.cuisine}
                    onChange={(e) => updateParsedRecipe({ cuisine: e.target.value })}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Servings
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={parsedRecipe.defaultServings}
                    onChange={(e) => updateParsedRecipe({ defaultServings: Number(e.target.value) || 1 })}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Prep Minutes
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={parsedRecipe.prepTimeMinutes}
                    onChange={(e) => {
                      const prepTimeMinutes = Number(e.target.value) || 0;
                      updateParsedRecipe({
                        prepTimeMinutes,
                        totalTimeMinutes: prepTimeMinutes + parsedRecipe.cookTimeMinutes,
                      });
                    }}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Cook Minutes
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={parsedRecipe.cookTimeMinutes}
                    onChange={(e) => {
                      const cookTimeMinutes = Number(e.target.value) || 0;
                      updateParsedRecipe({
                        cookTimeMinutes,
                        totalTimeMinutes: parsedRecipe.prepTimeMinutes + cookTimeMinutes,
                      });
                    }}
                    className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Ingredients
                  </span>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-50"
                  >
                    Add ingredient
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {parsedRecipe.ingredients.map((ingredient, index) => (
                    <div key={ingredient.id} className="grid grid-cols-12 gap-2 p-2 bg-white border border-stone-200 rounded-2xl">
                      <input
                        aria-label="Ingredient amount"
                        value={ingredient.amount ?? ''}
                        onChange={(e) => updateIngredient(index, { amount: parseNumberInput(e.target.value) })}
                        className="col-span-3 px-2 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="Qty"
                      />
                      <input
                        aria-label="Ingredient unit"
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                        className="col-span-3 px-2 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="Unit"
                      />
                      <input
                        aria-label="Ingredient name"
                        value={ingredient.name}
                        onChange={(e) => updateIngredient(index, { name: e.target.value })}
                        className={`col-span-5 px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                          ingredient.name.trim() ? 'border-stone-200' : 'border-amber-400'
                        }`}
                        placeholder="Ingredient"
                      />
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="col-span-1 text-stone-400 hover:text-rose-600 text-sm"
                        title="Remove ingredient"
                      >
                        ×
                      </button>
                      <select
                        value={ingredient.category}
                        onChange={(e) => updateIngredient(index, { category: e.target.value as IngredientCategory })}
                        className="col-span-12 px-2 py-1.5 border border-stone-200 rounded-lg text-xs bg-stone-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {INGREDIENT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    Story Steps
                  </span>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-50"
                  >
                    Add step
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {parsedRecipe.steps.map((step, index) => (
                    <div key={`${step.stepNumber}-${index}`} className="p-3 bg-white border border-stone-200 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <input
                          value={step.title || ''}
                          onChange={(e) => updateStep(index, { title: e.target.value })}
                          className="flex-1 px-2 py-1.5 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          placeholder="Step title"
                        />
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          className="text-stone-400 hover:text-rose-600 text-sm"
                          title="Remove step"
                        >
                          ×
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={step.instruction}
                        onChange={(e) => updateStep(index, { instruction: e.target.value })}
                        className={`px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                          step.instruction.trim() ? 'border-stone-200' : 'border-amber-400'
                        }`}
                        placeholder="Step instruction"
                      />
                      <label className="flex items-center gap-2 text-[11px] text-stone-500">
                        <span>Timer seconds</span>
                        <input
                          type="number"
                          min="0"
                          value={step.timerSeconds ?? ''}
                          onChange={(e) => updateStep(index, { timerSeconds: parseNumberInput(e.target.value) || undefined })}
                          className="w-28 px-2 py-1 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* Web Link Tab */}
          {activeTab === 'link' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-stone-700">
                Recipe Webpage URL
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://cooking.nytimes.com/... or any food blog URL"
                className="w-full px-4 py-3 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-xs"
              />
              <p className="text-[11px] text-stone-500">
                Paste any URL from Serious Eats, NYT Cooking, Bon Appétit, or personal blogs. Our AI automatically extracts standardized steps, ingredients, timings, and quantities.
              </p>
            </div>
          )}

          {/* YouTube Video or Shorts Tab */}
          {activeTab === 'youtube' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Youtube className="w-4 h-4 text-red-600" />
                <span>YouTube Video or YouTube Shorts URL</span>
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/shorts/... or https://youtu.be/..."
                className="w-full px-4 py-3 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-xs"
              />
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-stone-500">
                  Quick try:
                </span>
                <button
                  type="button"
                  onClick={() => setUrlInput('https://www.youtube.com/shorts/3i_bU1_Z24E')}
                  className="text-[11px] text-amber-700 hover:underline font-medium"
                >
                  Example YouTube Short
                </button>
              </div>
              <p className="text-[11px] text-stone-500">
                Supports standard YouTube videos and vertical Shorts. AI will extract culinary techniques, ingredient ratios, and transform video instructions into step-by-step Story mode.
              </p>
            </div>
          )}

          {/* Photo / Screenshot / PDF Upload Tab */}
          {activeTab === 'media' && (
            <div className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-amber-500/70 bg-white/60 hover:bg-stone-50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
              >
                {filePreview ? (
                  <div className="flex flex-col items-center gap-2">
                    {file?.type.includes('pdf') ? (
                      <div className="w-16 h-16 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                        <FileText className="w-8 h-8" />
                      </div>
                    ) : (
                      <img
                        src={filePreview}
                        alt="Recipe upload preview"
                        className="w-32 h-32 object-cover rounded-xl shadow-md border border-stone-200"
                      />
                    )}
                    <span className="text-xs font-semibold text-stone-800">
                      {file?.name}
                    </span>
                    <span className="text-[11px] text-stone-600">
                      Click to change file
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-stone-500">
                    <div className="p-3 rounded-full bg-stone-100 text-stone-600">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-stone-800">
                      Drop recipe photo, screenshot, or PDF here
                    </span>
                    <span className="text-[11px] text-stone-600">
                      Takes handwritten recipes, cookbook snaps, magazine clippings, or Instagram captures
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Text Tab */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-stone-700">
                Paste Recipe Text, Ingredients & Instructions
              </label>
              <textarea
                rows={6}
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                placeholder="Paste unformatted ingredients, grandma's recipe notes, or steps..."
                className="w-full p-3.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-xs font-mono"
              />
            </div>
          )}

          {/* AI Curator Highlight Banner */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-2.5 text-xs text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Gemini automatically scales units, detects timers, structures aisle categories, and prepares Instacart search queries.
            </span>
          </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 pt-2 border-t border-stone-200/80 flex items-center justify-end gap-3">
          {parsedRecipe ? (
            <>
              <button
                type="button"
                onClick={() => setParsedRecipe(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-xl transition-colors"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleSavePreview}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Save to Cookbook</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={isProcessing ? handleStopImport : handleClose}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-xl transition-colors"
              >
                {isProcessing ? 'Stop' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleImport}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Curating with AI…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Preview Recipe</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
