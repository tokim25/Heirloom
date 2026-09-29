import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Copy, LogOut, Plus, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { GroceryList, Recipe } from '../types/recipe.ts';
import { formatInviteCode } from '../utils/firestoreService.ts';
import { storeNotice, visibleStoreNames } from '../utils/storeOptions.ts';
import { Sheet } from './ui/Sheet.tsx';

interface UserProfileModalProps {
  onClose: () => void;
  recipes?: Recipe[];
  groceryLists?: GroceryList[];
  onOpenDriveBackup?: () => void;
}

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

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** A titled group of rows, like a settings screen. */
const Group: React.FC<{ title?: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="flex flex-col gap-2">
    {title && <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-stone-600">{title}</h3>}
    <div className="rounded-2xl bg-surface border border-stone-200/80 divide-y divide-stone-100 overflow-hidden">{children}</div>
    {note && <p className="px-1 text-sm text-stone-600">{note}</p>}
  </section>
);

const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`min-h-14 px-4 py-2.5 flex items-center gap-3 ${className}`}>{children}</div>
);

const Avatar: React.FC<{ name: string; url?: string; size?: number }> = ({ name, url, size = 40 }) =>
  url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 flex items-center justify-center font-serif font-semibold shrink-0"
      aria-hidden="true"
    >
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ onClose, recipes = [], onOpenDriveBackup }) => {
  const {
    user,
    updateProfile,
    isGoogleSignedIn,
    isGoogleConnected,
    isDriveCopyEnabled,
    household,
    signInWithGoogle,
    authErrorMessage,
    clearAuthError,
    logout,
  } = useAuth();

  const [preferredStore, setPreferredStore] = useState(() => {
    const savedLocal = typeof window !== 'undefined' ? localStorage.getItem('heirloom_preferred_store') : null;
    return savedLocal || user?.preferredStore || 'Whole Foods Market';
  });
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(user?.dietaryPreferences || []);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Every change saves on its own, so there is no Save button to forget.
  const save = async (updates: Parameters<typeof updateProfile>[0]) => {
    setSaveState('saving');
    try {
      await updateProfile(updates);
      setSaveState('saved');
      window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch {
      setSaveState('error');
    }
  };

  const cookbookTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => Array.isArray(r.tags) && r.tags.forEach((t) => typeof t === 'string' && t.trim() && set.add(t.trim())));
    return Array.from(set);
  }, [recipes]);

  const allTags = useMemo(
    () => Array.from(new Set([...BASE_DIETARY_TAGS, ...cookbookTags, ...dietaryPreferences])),
    [cookbookTags, dietaryPreferences]
  );

  const members = useMemo(
    () =>
      Object.values(household?.members || {}).sort((a, b) => {
        if (a.id === user?.id) return -1;
        if (b.id === user?.id) return 1;
        return a.name.localeCompare(b.name);
      }),
    [household, user?.id]
  );
  const inviteCode = household?.inviteCode ? formatInviteCode(household.inviteCode) : '';

  const toggleTag = (tag: string) => {
    const next = dietaryPreferences.includes(tag) ? dietaryPreferences.filter((t) => t !== tag) : [...dietaryPreferences, tag];
    setDietaryPreferences(next);
    void save({ dietaryPreferences: next });
  };

  const addCustomTag = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = customTagInput.trim();
    if (clean && !dietaryPreferences.includes(clean)) {
      const next = [...dietaryPreferences, clean];
      setDietaryPreferences(next);
      void save({ dietaryPreferences: next });
    }
    setCustomTagInput('');
    setIsAddingTag(false);
  };

  const changeStore = (name: string) => {
    setPreferredStore(name);
    localStorage.setItem('heirloom_preferred_store', name);
    void save({ preferredStore: name });
  };

  const copyInvite = async () => {
    if (!inviteCode) return;
    const text = `Join my kitchen on Heirloom to share recipes and grocery lists.\nInvite code: ${inviteCode}\nOpen https://heirloom.tonykim.io, then Groceries > + > Join with code.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1800);
    } catch {
      setCopiedInvite(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSignInError(null);
    clearAuthError();
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setSignInError(err?.message || 'Could not sign in with Google. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const driveStatus = isGoogleConnected ? 'On' : isDriveCopyEnabled ? 'Paused' : 'Off';
  const notice = storeNotice(preferredStore);
  const statusText =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Could not save. Check your connection.' : 'Changes save automatically.';

  return (
    <Sheet open onClose={onClose} title="Profile" description={isGoogleSignedIn && user ? statusText : undefined} size="lg" fullOnMobile>
      {!isGoogleSignedIn || !user ? (
        <Group>
          <div className="p-5 flex flex-col gap-3">
            <p className="font-serif text-xl text-stone-900">Sign in to sync your cookbook</p>
            <p className="text-sm text-stone-600">Your recipes and grocery lists follow you to every device you sign in on.</p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="min-h-12 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-60 text-white text-base font-semibold inline-flex items-center justify-center gap-2"
            >
              {isSigningIn && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Continue with Google
            </button>
            {(signInError || authErrorMessage) && (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                {signInError || authErrorMessage}
              </p>
            )}
          </div>
        </Group>
      ) : (
        <>
          <Group>
            <Row className="py-4">
              <Avatar name={user.name} url={user.avatarUrl} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl text-stone-900 truncate">{user.name}</p>
                <p className="text-sm text-stone-600 truncate">{user.email}</p>
              </div>
            </Row>
          </Group>

          <Group title="Sync">
            <Row>
              <span className="flex-1 text-base text-stone-900">Cookbook and lists</span>
              <span className="text-sm text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5">
                <Check className="w-4 h-4" aria-hidden="true" />
                Synced
              </span>
            </Row>
            {onOpenDriveBackup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDriveBackup();
                }}
                className="w-full min-h-14 px-4 py-2.5 flex items-center gap-3 text-left hover:bg-stone-50 active:bg-stone-100"
              >
                <span className="flex-1 text-base text-stone-900">Google Drive copy</span>
                <span className={`text-sm ${driveStatus === 'On' ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-600'}`}>{driveStatus}</span>
                <ChevronRight className="w-5 h-5 text-stone-400" aria-hidden="true" />
              </button>
            )}
          </Group>

          <Group title="Household" note="Everyone here shares the cookbook and grocery lists.">
            {members.map((member) => (
              <Row key={member.id}>
                <Avatar name={member.name} url={member.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="text-base text-stone-900 truncate">
                    {member.name}
                    {member.id === user.id && <span className="text-stone-500"> (you)</span>}
                  </p>
                  <p className="text-sm text-stone-600 truncate">{member.email}</p>
                </div>
              </Row>
            ))}
            {inviteCode && (
              <Row>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-600">Invite code for a partner or family</p>
                  <p className="font-mono text-base font-semibold tracking-wide text-stone-900">{inviteCode}</p>
                </div>
                <button
                  type="button"
                  onClick={copyInvite}
                  className="min-h-11 px-4 rounded-xl border border-stone-300 bg-surface hover:bg-stone-50 text-sm font-semibold text-stone-800 inline-flex items-center gap-1.5 shrink-0"
                >
                  {copiedInvite ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  {copiedInvite ? 'Copied' : 'Copy'}
                </button>
              </Row>
            )}
          </Group>

          <Group title="Groceries" note={notice ?? undefined}>
            <Row>
              <label htmlFor="default-store" className="text-base text-stone-900 shrink-0">
                Default store
              </label>
              <select
                id="default-store"
                value={preferredStore}
                onChange={(e) => changeStore(e.target.value)}
                className="flex-1 min-w-0 min-h-11 px-3 rounded-xl bg-surface border border-stone-300 text-base text-stone-900 text-right"
              >
                {visibleStoreNames(user.customStores, user.hiddenStores, preferredStore).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Row>
          </Group>

          <Group title="Food preferences" note="Tags are collected from your recipes. Tap the ones that matter to you.">
            <div className="p-3 flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const active = dietaryPreferences.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={active}
                    className={`min-h-10 px-3.5 rounded-full text-sm font-medium border transition-colors ${
                      active
                        ? 'bg-amber-500 border-amber-500 text-on-accent font-semibold'
                        : 'bg-surface border-stone-300 text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {isAddingTag ? (
                <form onSubmit={addCustomTag} className="flex items-center gap-1.5">
                  <label className="sr-only" htmlFor="new-tag">
                    New tag
                  </label>
                  <input
                    id="new-tag"
                    autoFocus
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="New tag"
                    className="min-h-10 w-36 px-3 rounded-full bg-surface border border-stone-300 text-base text-stone-900"
                  />
                  <button type="submit" className="min-h-10 px-3 rounded-full bg-ink text-white text-sm font-semibold">
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTag(false);
                      setCustomTagInput('');
                    }}
                    aria-label="Cancel"
                    className="min-h-10 min-w-10 inline-flex items-center justify-center text-stone-600"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="min-h-10 px-3.5 rounded-full border border-dashed border-stone-400 text-sm font-medium text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add tag
                </button>
              )}
            </div>
          </Group>

          <Group>
            <button
              type="button"
              onClick={logout}
              className="w-full min-h-14 px-4 flex items-center justify-center gap-2 text-base font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign out
            </button>
          </Group>
        </>
      )}
    </Sheet>
  );
};
