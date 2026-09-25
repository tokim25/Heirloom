import React, { useState, useMemo } from 'react';
import {
  X,
  User as UserIcon,
  Store,
  Users,
  Heart,
  Save,
  Check,
  Sparkles,
  Cloud,
  ExternalLink,
  Plus,
  Tag,
  AlertCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Recipe } from '../types/recipe.ts';

interface UserProfileModalProps {
  onClose: () => void;
  recipes?: Recipe[];
  onOpenDriveBackup?: () => void;
}

const STORES = [
  'Whole Foods Market',
  "Trader Joe's",
  'Safeway',
  'Kroger',
  'Wegmans',
  'Sprouts',
  'Costco',
  'H Mart',
];

const BASE_DIETARY_TAGS = [
  'High-Protein',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto / Low-Carb',
  'Mediterranean',
  'Nut-Free',
  'Organic Preferred',
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  onClose,
  recipes = [],
  onOpenDriveBackup,
}) => {
  const {
    user,
    updateProfile,
    isGoogleConnected,
    signInWithGoogle,
    disconnectGoogleDrive,
  } = useAuth();

  const [preferredStore, setPreferredStore] = useState(user?.preferredStore || 'Whole Foods Market');
  const [partnerEmail, setPartnerEmail] = useState(user?.partnerEmail || 'alex@family.kitchen');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(user?.dietaryPreferences || ['High-Protein']);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<{ message: string; isDomainError?: boolean } | null>(null);

  // Dynamically extract every unique tag present in the user's cookbook
  const dynamicCookbookTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => {
      if (Array.isArray(r.tags)) {
        r.tags.forEach((t) => {
          if (t && typeof t === 'string' && t.trim().length > 0) {
            set.add(t.trim());
          }
        });
      }
    });
    return Array.from(set);
  }, [recipes]);

  // Combine baseline dietary tags, tags from existing recipes, and any custom user tags
  const allAvailableTags = useMemo(() => {
    const combined = new Set<string>([
      ...BASE_DIETARY_TAGS,
      ...dynamicCookbookTags,
      ...dietaryPreferences,
    ]);
    return Array.from(combined);
  }, [dynamicCookbookTags, dietaryPreferences]);

  const toggleDiet = (item: string) => {
    setDietaryPreferences((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customTagInput.trim();
    if (clean && !dietaryPreferences.includes(clean)) {
      setDietaryPreferences((prev) => [...prev, clean]);
      setCustomTagInput('');
      setIsAddingTag(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const isDomainError =
        err?.code === 'auth/unauthorized-domain' ||
        err?.message?.includes('auth/unauthorized-domain');

      if (isDomainError) {
        setAuthError({
          message:
            'Firebase requires your custom domain (heirloom.tonykim.io) to be added to Authorized Domains in your Firebase Console.',
          isDomainError: true,
        });
      } else {
        setAuthError({
          message: err?.message || 'Failed to sign in with Google. Please try again.',
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      preferredStore,
      partnerEmail,
      dietaryPreferences,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                Chef Profile & Identity
              </span>
              <h2 className="font-serif text-2xl text-stone-900 leading-tight">
                Account & Kitchen Profile
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 flex flex-col gap-6">
          {/* SECTION 1: Standard Google Sign-In / Account Surface */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-xs">
            {isGoogleConnected && user ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-serif text-lg font-bold">
                        {user.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-stone-900 text-base">{user.name}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Google Verified
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">{user.email}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={disconnectGoogleDrive}
                    className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                    title="Disconnect Google Account"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Google Drive Backup Vault Active
                  </span>
                  {onOpenDriveBackup && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenDriveBackup();
                      }}
                      className="text-amber-700 hover:text-amber-800 font-medium underline flex items-center gap-1"
                    >
                      <span>Manage Cloud Vault</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900 text-sm sm:text-base">
                      Sign in with Google to Import Profile
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                      Automatically syncs your chef name, photo, household meal plans, and links your private Google Drive recipe backup vault in one step.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all"
                >
                  {isSigningIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-stone-300" />
                      <span>Connecting with Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Error Banner with 1-Click Domain Authorization Link */}
                {authError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">{authError.message}</p>
                        {authError.isDomainError && (
                          <p className="text-rose-700 text-[11px] mt-1">
                            Firebase requires listing custom domains under Authorized Domains to prevent unauthorized OAuth redirects.
                          </p>
                        )}
                      </div>
                    </div>

                    {authError.isDomainError && (
                      <a
                        href="https://console.firebase.google.com/project/nth-imagery-298121/authentication/settings"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-xs transition-colors self-start"
                      >
                        <span>Add heirloom.tonykim.io to Firebase Settings</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: Culinary Focus & Dynamic Recipe Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dietary Preferences & Culinary Tags</span>
                </label>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Automatically extracts tags from your {recipes.length} recipes + custom tags you add.
                </p>
              </div>

              {!isAddingTag && (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Tag</span>
                </button>
              )}
            </div>

            {/* Custom Tag Input Form */}
            {isAddingTag && (
              <div className="mb-3 p-2.5 bg-stone-100 rounded-xl border border-stone-200 flex items-center gap-2">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag();
                    }
                  }}
                  placeholder="e.g. Pescatarian, Low-Sodium, Sous-Vide..."
                  className="flex-1 px-3 py-2 text-base sm:text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomTag()}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shrink-0"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTag(false);
                    setCustomTagInput('');
                  }}
                  className="p-1.5 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Dynamic Tag Pills */}
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-stone-100/50 rounded-2xl border border-stone-200/60">
              {allAvailableTags.map((item) => {
                const active = dietaryPreferences.includes(item);
                const isFromCookbook = dynamicCookbookTags.includes(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleDiet(item)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      active
                        ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-200/70 border border-stone-200/70'
                    }`}
                  >
                    <span>{item}</span>
                    {isFromCookbook && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded-full ${
                          active ? 'bg-amber-600/30 text-stone-950' : 'bg-stone-100 text-stone-500'
                        }`}
                        title="Found in your recipes"
                      >
                        recipe
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Household & Supermarket Preferences */}
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5 mb-1">
                <Store className="w-3.5 h-3.5 text-stone-600" />
                <span>Default Supermarket (Instacart Sync)</span>
              </label>
              <select
                value={preferredStore}
                onChange={(e) => setPreferredStore(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium text-stone-800"
              >
                {STORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-stone-600" />
                <span>Partner / Collaborator Email (Real-time Shopping)</span>
              </label>
              <input
                type="email"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="partner@example.com"
                className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-stone-800"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Your partner can check off grocery aisles and sync pantry items with your household in real-time.
              </p>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-stone-600 hover:text-stone-900"
              >
                Close
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Kitchen Preferences</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
