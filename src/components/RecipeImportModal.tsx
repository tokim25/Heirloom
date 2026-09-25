import React, { useState, useRef } from 'react';
import {
  X,
  Link2,
  FileText,
  Image as ImageIcon,
  Youtube,
  UploadCloud,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { Recipe } from '../types/recipe.ts';

interface RecipeImportModalProps {
  onClose: () => void;
  onRecipeImported: (recipe: Recipe) => void;
}

type TabType = 'link' | 'media' | 'youtube' | 'text';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to curate recipe');
      }

      const data = await res.json();
      if (data.recipe) {
        onRecipeImported(data.recipe);
        onClose();
      } else {
        throw new Error('No recipe content parsed');
      }
    } catch (err: unknown) {
      console.error('Import error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to import recipe';
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto">
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
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
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

        {/* Tab Body */}
        <div className="p-6 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

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
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 pt-2 border-t border-stone-200/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-xl transition-colors"
          >
            Cancel
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
                <span>Curate & Save to Cookbook</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
