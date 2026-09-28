import React, { useEffect, useRef, useState } from 'react';
import { X, Link2, FileText, Image as ImageIcon, UploadCloud, Loader2, AlertCircle, Check, ArrowLeft, ClipboardPaste } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import { apiFetch } from '../utils/api.ts';
import { prepareUpload, PreparedUpload } from '../utils/imageUpload.ts';
import { cleanRecipeForSave, validateRecipeForSave } from '../utils/recipeSchema.ts';
import { RecipeEditor, getRecipeReviewWarnings } from './RecipeEditor.tsx';

interface RecipeImportModalProps {
  onClose: () => void;
  onRecipeImported: (recipe: Recipe) => void | Promise<void>;
}

type TabType = 'link' | 'media' | 'text';

interface ImportProblem {
  message: string;
  // Offer the paste-text fallback when the source itself was the obstacle.
  offerPasteText: boolean;
}

// Server allows 60s (vercel.json); leave a little slack for the network.
const IMPORT_TIMEOUT_MS = 58000;

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'link', label: 'Link', icon: <Link2 className="w-4 h-4" /> },
  { id: 'media', label: 'Photo / PDF', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'text', label: 'Text', icon: <FileText className="w-4 h-4" /> },
];

export const RecipeImportModal: React.FC<RecipeImportModalProps> = ({ onClose, onRecipeImported }) => {
  const [activeTab, setActiveTab] = useState<TabType>('link');
  const [urlInput, setUrlInput] = useState('');
  const [rawTextInput, setRawTextInput] = useState('');
  // Set when the user falls back to pasting text for a page Heirloom could not read.
  const [pastedFromUrl, setPastedFromUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [upload, setUpload] = useState<(PreparedUpload & { previewUrl: string | null }) | null>(null);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [problem, setProblem] = useState<ImportProblem | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<Recipe | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (problem) problemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [problem]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      importAbortRef.current?.abort();
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    setProblem(null);
    setIsPreparingFile(true);
    try {
      const prepared = await prepareUpload(selected);
      setUpload({ ...prepared, previewUrl: prepared.mimeType === 'application/pdf' ? null : prepared.dataUrl });
    } catch (err) {
      setUpload(null);
      setProblem({ message: err instanceof Error ? err.message : 'That file could not be prepared.', offerPasteText: false });
    } finally {
      setIsPreparingFile(false);
    }
  };

  const handleImport = async () => {
    setProblem(null);

    let payload: Record<string, unknown>;
    if (activeTab === 'link') {
      if (!urlInput.trim()) return setProblem({ message: 'Paste a recipe or YouTube link first.', offerPasteText: false });
      payload = { url: urlInput.trim() };
    } else if (activeTab === 'media') {
      if (!upload) return setProblem({ message: 'Choose a photo, screenshot, or PDF first.', offerPasteText: false });
      payload = { fileData: upload.dataUrl, mimeType: upload.mimeType, fileName: upload.fileName };
    } else {
      if (!rawTextInput.trim()) return setProblem({ message: 'Paste or type the recipe first.', offerPasteText: false });
      payload = { rawText: rawTextInput.trim(), ...(pastedFromUrl ? { sourceUrl: pastedFromUrl } : {}) };
    }

    setIsProcessing(true);
    importAbortRef.current?.abort();
    const controller = new AbortController();
    importAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

    try {
      const res = await apiFetch('/api/recipes/parse', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          res.status === 413
            ? 'That file is too large to upload. Try a smaller photo or PDF.'
            : res.status === 401
            ? 'Your session expired. Sign in again and retry.'
            : body.error || 'Could not read that recipe. Try again, or paste the recipe text instead.';
        setProblem({
          message,
          offerPasteText: activeTab !== 'text' && ['blocked', 'video_unreadable', 'no_recipe'].includes(body.code),
        });
        return;
      }

      const data = await res.json();
      if (!data.recipe) throw new Error('No recipe came back.');
      setParsedRecipe(data.recipe);
    } catch (err: unknown) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      setProblem({
        message: aborted
          ? 'That took too long. Try again, or paste the recipe text instead.'
          : err instanceof Error
          ? err.message
          : 'Could not import that recipe.',
        offerPasteText: aborted && activeTab !== 'text',
      });
    } finally {
      window.clearTimeout(timeoutId);
      if (importAbortRef.current === controller) importAbortRef.current = null;
      setIsProcessing(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    setProblem(null);
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setProblem({ message: 'Your clipboard is empty. Copy the recipe from the page first.', offerPasteText: false });
        return;
      }
      setRawTextInput(text);
    } catch {
      setProblem({
        message: 'Your browser did not allow pasting from the button. Tap into the box and paste instead.',
        offerPasteText: false,
      });
      textareaRef.current?.focus();
    }
  };

  const handleClose = () => {
    importAbortRef.current?.abort();
    onClose();
  };

  const handleSave = async () => {
    if (!parsedRecipe) return;
    const invalid = validateRecipeForSave(parsedRecipe);
    if (invalid) return setProblem({ message: invalid, offerPasteText: false });

    setProblem(null);
    setIsProcessing(true);
    try {
      await onRecipeImported(cleanRecipeForSave(parsedRecipe));
      onClose();
    } catch (err: unknown) {
      setProblem({ message: err instanceof Error ? err.message : 'Could not save that recipe.', offerPasteText: false });
    } finally {
      setIsProcessing(false);
    }
  };

  const warnings = parsedRecipe ? getRecipeReviewWarnings(parsedRecipe) : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="relative w-full sm:max-w-xl bg-[#FAF9F5] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]"
      >
        <div className="px-6 pt-5 pb-4 border-b border-stone-200/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="import-title" className="font-serif text-2xl text-stone-900">
              {parsedRecipe ? 'Check your recipe' : 'Add a recipe'}
            </h2>
            {parsedRecipe && <p className="text-sm text-stone-600 mt-0.5">Fix anything that looks off, then save.</p>}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="min-h-11 min-w-11 -mr-2 inline-flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-stone-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!parsedRecipe && (
          <div role="tablist" className="flex border-b border-stone-200 bg-stone-100/70 p-1.5 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setProblem(null);
                  setPastedFromUrl(null);
                }}
                className={`flex-1 min-h-11 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === tab.id ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {problem && (
            <div ref={problemRef} role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col gap-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{problem.message}</span>
              </div>
              {problem.offerPasteText && (
                <button
                  type="button"
                  onClick={() => {
                    setPastedFromUrl(activeTab === 'link' ? urlInput.trim() || null : null);
                    setActiveTab('text');
                    setProblem(null);
                    window.setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  className="self-start min-h-11 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-semibold"
                >
                  Paste the recipe text instead
                </button>
              )}
            </div>
          )}

          {parsedRecipe ? (
            <>
              {warnings.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-col gap-1.5">
                  <span className="font-semibold">Worth a look</span>
                  <ul className="list-disc pl-5">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <RecipeEditor recipe={parsedRecipe} onChange={setParsedRecipe} />
            </>
          ) : (
            <>
              {activeTab === 'link' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="import-url" className="text-sm font-semibold text-stone-800">
                    Recipe or YouTube link
                  </label>
                  <input
                    id="import-url"
                    type="url"
                    inputMode="url"
                    autoFocus
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleImport()}
                    placeholder="https://"
                    className="w-full px-4 min-h-12 text-base bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <p className="text-sm text-stone-600">
                    Works with recipe sites and YouTube videos or Shorts. Heirloom only saves what the page or video actually says.
                  </p>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="flex flex-col gap-3">
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 hover:border-amber-500/70 bg-white/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-44"
                  >
                    {isPreparingFile ? (
                      <span className="flex items-center gap-2 text-sm text-stone-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing…
                      </span>
                    ) : upload ? (
                      <span className="flex flex-col items-center gap-2">
                        {upload.previewUrl ? (
                          <img src={upload.previewUrl} alt="Selected recipe" className="w-32 h-32 object-cover rounded-xl border border-stone-200" />
                        ) : (
                          <span className="w-16 h-16 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                            <FileText className="w-8 h-8" />
                          </span>
                        )}
                        <span className="text-sm font-semibold text-stone-800 break-all">{upload.fileName}</span>
                        <span className="text-sm text-stone-600">Tap to choose a different file</span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-2 text-stone-600">
                        <UploadCloud className="w-7 h-7" />
                        <span className="text-sm font-semibold text-stone-800">Choose a photo, screenshot, or PDF</span>
                        <span className="text-sm">Recipe cards, cookbook pages, and clippings all work</span>
                      </span>
                    )}
                  </button>
                </div>
              )}

              {activeTab === 'text' && (
                <div className="flex flex-col gap-3">
                  {pastedFromUrl && (
                    <p className="text-sm text-stone-700">
                      Open the page, copy the recipe, then tap <span className="font-semibold">Paste from clipboard</span>. Your link
                      is kept so the saved recipe still points back to it.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="import-text" className="text-sm font-semibold text-stone-800">
                      Paste the recipe
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-800"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      Paste from clipboard
                    </button>
                  </div>
                  <textarea
                    id="import-text"
                    ref={textareaRef}
                    rows={8}
                    value={rawTextInput}
                    onChange={(e) => setRawTextInput(e.target.value)}
                    placeholder="Ingredients and steps, however they're written"
                    className="w-full p-3.5 text-base bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 sm:px-6 border-t border-stone-200/80 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {parsedRecipe ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setParsedRecipe(null);
                  setProblem(null);
                }}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 min-h-11 px-4 text-sm font-semibold text-stone-700 hover:text-stone-950 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                Start over
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 min-h-12 px-6 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-base font-semibold"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save recipe
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={isProcessing ? () => importAbortRef.current?.abort() : handleClose}
                className="min-h-11 px-4 text-sm font-semibold text-stone-700 hover:text-stone-950 rounded-xl"
              >
                {isProcessing ? 'Stop' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isProcessing || isPreparingFile}
                className="inline-flex items-center gap-2 min-h-12 px-6 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-base font-semibold"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                {isProcessing ? 'Reading recipe…' : 'Read recipe'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
