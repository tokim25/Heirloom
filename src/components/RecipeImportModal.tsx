import React, { useEffect, useRef, useState } from 'react';
import { Link2, Sparkles, FileText, Image as ImageIcon, UploadCloud, Loader2, AlertCircle, Check, ArrowLeft, ClipboardPaste } from 'lucide-react';
import { Recipe } from '../types/recipe.ts';
import { apiFetch } from '../utils/api.ts';
import { prepareUpload, PreparedUpload } from '../utils/imageUpload.ts';
import { cleanRecipeForSave, validateRecipeForSave } from '../utils/recipeSchema.ts';
import { RecipeEditor, getRecipeReviewWarnings } from './RecipeEditor.tsx';
import { socialVideoSite } from '../utils/pageExtract.ts';
import { Sheet } from './ui/Sheet.tsx';

interface RecipeImportModalProps {
  onClose: () => void;
  onRecipeImported: (recipe: Recipe) => void | Promise<void>;
  /** Opens Chef AI for people who do not have a recipe yet. */
  onAskChefAi?: () => void;
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

/** Lets a link like /add?url=https://... (or a shared page's text) open Add with the address filled in. */
const initialUrlFromLocation = (): string => {
  try {
    const params = new URLSearchParams(window.location.search);
    const direct = params.get('url');
    if (direct && /^https?:\/\//i.test(direct)) return direct;
    return params.get('text')?.match(/https?:\/\/\S+/)?.[0] ?? '';
  } catch {
    return '';
  }
};

export const RecipeImportModal: React.FC<RecipeImportModalProps> = ({ onClose, onRecipeImported, onAskChefAi }) => {
  const [activeTab, setActiveTab] = useState<TabType>('link');
  const [urlInput, setUrlInput] = useState(initialUrlFromLocation);
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
    return () => importAbortRef.current?.abort();
  }, []);

  // Prepares a photo or PDF (shrinks big photos) and, when it arrived by drop or paste, starts reading it.
  const acceptFile = async (file: File, autoStart: boolean) => {
    setProblem(null);
    setActiveTab('media');
    setIsPreparingFile(true);
    try {
      const prepared = await prepareUpload(file);
      setUpload({ ...prepared, previewUrl: prepared.mimeType === 'application/pdf' ? null : prepared.dataUrl });
      if (autoStart) {
        await runImport({ fileData: prepared.dataUrl, mimeType: prepared.mimeType, fileName: prepared.fileName }, 'media');
      }
    } catch (err) {
      setUpload(null);
      setProblem({ message: err instanceof Error ? err.message : 'That file could not be prepared.', offerPasteText: false });
    } finally {
      setIsPreparingFile(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (selected) await acceptFile(selected, false);
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

    await runImport(payload, activeTab);
  };

  const runImport = async (payload: Record<string, unknown>, tab: TabType) => {
    const social = tab === 'link' && typeof payload.url === 'string' ? socialVideoSite(payload.url) : null;
    if (social) {
      setProblem({
        message: `${social} does not let apps read its videos, so Heirloom cannot open this link. Copy the recipe from the caption and paste it, or screenshot the recipe and use the Photo tab.`,
        offerPasteText: true,
      });
      return;
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
          offerPasteText: tab !== 'text' && ['blocked', 'video_unreadable', 'no_recipe'].includes(body.code),
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
        offerPasteText: aborted && tab !== 'text',
      });
    } finally {
      window.clearTimeout(timeoutId);
      if (importAbortRef.current === controller) importAbortRef.current = null;
      setIsProcessing(false);
    }
  };

  // Drop a photo, PDF or link anywhere on screen (or paste a screenshot) to import it. The listeners are on
  // the window because otherwise a drop that misses the target makes the browser open the file instead.
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragDepth = useRef(0);
  const dropHandlers = useRef({ onDropFile: (_f: File) => {}, onDropText: (_t: string) => {} });
  dropHandlers.current = {
    onDropFile: (file) => {
      if (isProcessing || parsedRecipe) return;
      if (!/^(image\/|application\/pdf$)/.test(file.type)) {
        setProblem({ message: 'Drop a photo, screenshot, or PDF.', offerPasteText: false });
        return;
      }
      void acceptFile(file, true);
    },
    onDropText: (text) => {
      if (isProcessing || parsedRecipe) return;
      const link = text.trim().split(/\s+/)[0];
      if (/^https?:\/\/\S+$/i.test(link)) {
        setActiveTab('link');
        setUrlInput(link);
        setProblem(null);
        void runImport({ url: link }, 'link');
      } else if (text.trim().length > 40) {
        setActiveTab('text');
        setRawTextInput(text.trim());
        setProblem(null);
      }
    },
  };

  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current += 1;
      if (hasFiles(e)) setIsDraggingFile(true);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDraggingFile(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDraggingFile(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) return dropHandlers.current.onDropFile(file);
      const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
      if (text) dropHandlers.current.onDropText(text);
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      dropHandlers.current.onDropFile(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

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
    <Sheet
      open
      onClose={handleClose}
      title={parsedRecipe ? 'Check your recipe' : 'Add a recipe'}
      description={parsedRecipe ? 'Fix anything that looks off, then save.' : undefined}
      size="xl"
      footer={
        <>
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
                className="inline-flex items-center gap-2 min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-50 text-white text-base font-semibold"
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
                className="inline-flex items-center gap-2 min-h-12 px-6 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-50 text-white text-base font-semibold"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                {isProcessing ? 'Reading recipe…' : 'Read recipe'}
              </button>
            </>
          )}
        </>
      }
    >
        {!parsedRecipe && (
          <div role="tablist" className="flex bg-stone-100 p-1 gap-1 rounded-2xl">
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
                  activeTab === tab.id ? 'bg-surface text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}


          {isDraggingFile && !parsedRecipe && (
        <div
          role="presentation"
          className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center bg-ink-deep/60 backdrop-blur-[2px]"
        >
          <div className="rounded-3xl border-2 border-dashed border-amber-400 bg-surface px-10 py-8 text-center shadow-2xl">
            <UploadCloud className="w-10 h-10 mx-auto text-amber-600" aria-hidden="true" />
            <p className="mt-2 font-serif text-2xl text-stone-900">Drop to add this recipe</p>
            <p className="text-sm text-stone-600">Photos, screenshots and PDFs</p>
          </div>
        </div>
      )}

      {problem && (
            <div ref={problemRef} role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col gap-2.5 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/50">
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
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-col gap-1.5 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800/50">
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
                    className="w-full px-4 min-h-12 text-base bg-surface border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  <p className="text-sm text-stone-600">
                    Works with recipe sites and YouTube videos or Shorts. Heirloom only saves what the page or video actually says.
                  </p>
                  {onAskChefAi && (
                    <button
                      type="button"
                      onClick={onAskChefAi}
                      className="self-start inline-flex items-center gap-1.5 min-h-11 -ml-1 px-2 text-sm font-semibold text-amber-800 hover:text-amber-950 rounded-xl dark:text-amber-200 dark:hover:text-amber-100"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      No recipe yet? Ask Chef AI
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'media' && (
                <div className="flex flex-col gap-3">
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 hover:border-amber-500/70 bg-surface/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-44"
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
                          <span className="w-16 h-16 rounded-xl bg-red-100 text-red-600 flex items-center justify-center dark:bg-red-900/40 dark:text-red-400">
                            <FileText className="w-8 h-8" />
                          </span>
                        )}
                        <span className="text-sm font-semibold text-stone-800 break-all">{upload.fileName}</span>
                        <span className="text-sm text-stone-600">Tap to choose a different file</span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-2 text-stone-600">
                        <UploadCloud className="w-7 h-7" />
                        <span className="text-sm font-semibold text-stone-800">Drop a photo, screenshot, or PDF here</span>
                        <span className="text-sm">or click to choose one. You can also paste a screenshot.</span>
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
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-stone-300 bg-surface hover:bg-stone-50 text-sm font-semibold text-stone-800"
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
                    className="w-full p-3.5 text-base bg-surface border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              )}
            </>
          )}
    </Sheet>
  );
};
