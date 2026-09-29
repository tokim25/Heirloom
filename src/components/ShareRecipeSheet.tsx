import React, { useEffect, useState } from 'react';
import { Check, ClipboardCopy, Link2, Loader2, RefreshCw, Send, Share2, X } from 'lucide-react';
import { Recipe, ShareInvite, SharedRecipe } from '../types/recipe.ts';
import { normalizeEmail } from '../utils/inbox.ts';
import { ConfirmSheet, Sheet } from './ui/Sheet.tsx';
import { shareUrl } from '../utils/shareLink.ts';

interface ShareRecipeSheetProps {
  recipe: Recipe;
  load: () => Promise<SharedRecipe | null>;
  create: () => Promise<SharedRecipe>;
  refresh: (share: SharedRecipe) => Promise<SharedRecipe>;
  stop: (share: SharedRecipe) => Promise<void>;
  listInvites: (share: SharedRecipe) => Promise<ShareInvite[]>;
  sendInvite: (share: SharedRecipe, email: string) => Promise<ShareInvite>;
  removeInvite: (invite: ShareInvite) => Promise<void>;
  onClose: () => void;
}

type Busy = 'create' | 'refresh' | 'stop' | 'send' | null;

/**
 * Share one recipe with someone outside your household. Nothing is shared until you create the link,
 * and you can stop at any time. The link gives a signed-in Heirloom user a preview and a Save button.
 */
export const ShareRecipeSheet: React.FC<ShareRecipeSheetProps> = ({ recipe, load, create, refresh, stop, listInvites, sendInvite, removeInvite, onClose }) => {
  const [share, setShare] = useState<SharedRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [invites, setInvites] = useState<ShareInvite[]>([]);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!share) {
      setInvites([]);
      return;
    }
    let cancelled = false;
    listInvites(share)
      .then((list) => !cancelled && setInvites(list))
      .catch(() => {
        // The list is a convenience; sending still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [share?.id]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((found) => !cancelled && setShare(found))
      .catch(() => !cancelled && setError('Could not check whether this recipe is already shared. Check your connection and try again.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>, failure: string) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message.includes('too large') ? err.message : failure);
    } finally {
      setBusy(null);
    }
  };

  const link = share ? shareUrl(window.location.origin, share.id) : '';
  const editedSinceShared = !!share && recipe.updatedAt > share.updatedAt;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Your browser did not allow copying. Select the link and copy it yourself.');
    }
  };

  const shareLink = async () => {
    try {
      await navigator.share({ title: recipe.title, text: `${recipe.title} on Heirloom`, url: link });
    } catch {
      // The person closed the share sheet.
    }
  };

  const send = () => {
    const to = normalizeEmail(email);
    if (!to) {
      setError('Enter the email address they use to sign in to Heirloom.');
      return;
    }
    if (invites.some((i) => i.toEmail === to)) {
      setError('You already sent this to that address.');
      return;
    }
    return run(
      'send',
      async () => {
        if (!share) return;
        const invite = await sendInvite(share, to);
        setInvites((list) => [...list, invite]);
        setEmail('');
      },
      'Could not send it. Check your connection and try again.'
    );
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Share this recipe"
      description={recipe.title}
      size="md"
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
      {loading ? (
        <p className="flex items-center gap-2 text-stone-600" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Checking…
        </p>
      ) : !share ? (
        <>
          <p className="text-base text-stone-800">
            Make a private link for this recipe. Anyone signed in to Heirloom who opens it can look at the recipe and save their own copy.
          </p>
          <ul className="text-sm text-stone-600 list-disc pl-5 flex flex-col gap-1">
            <li>Nothing is shared until you create the link, and you can stop sharing at any time.</li>
            <li>They get a copy. Later edits to your recipe are not shared unless you update the link.</li>
            <li>Only people who have the link can open it.</li>
          </ul>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run('create', async () => setShare(await create()), 'Could not create the link. Check your connection and try again.')}
            className="min-h-12 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-on-accent text-base font-semibold inline-flex items-center justify-center gap-2"
          >
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Link2 className="w-4 h-4" aria-hidden="true" />}
            Create share link
          </button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-800">Share link</span>
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-12 px-3 rounded-xl bg-surface border border-stone-300 text-base text-stone-900"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="min-h-12 px-5 rounded-xl border border-stone-300 bg-surface hover:bg-stone-50 text-base font-semibold text-stone-900 inline-flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <ClipboardCopy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {canShare && (
              <button
                type="button"
                onClick={shareLink}
                className="min-h-12 px-5 rounded-xl bg-ink hover:bg-ink-hover text-white text-base font-semibold inline-flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                Send…
              </button>
            )}
          </div>

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="send-to" className="text-sm font-semibold text-stone-800">
              Send to someone on Heirloom
            </label>
            <div className="flex gap-2">
              <input
                id="send-to"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="their Google email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-12 min-w-0 flex-1 px-3 rounded-xl bg-surface border border-stone-300 text-base text-stone-900 placeholder:text-stone-500"
              />
              <button
                type="submit"
                disabled={busy !== null || !email.trim()}
                className="min-h-12 px-4 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-50 text-white text-base font-semibold inline-flex items-center gap-2 shrink-0"
              >
                {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                Send
              </button>
            </div>
            <p className="text-xs text-stone-600">It lands in their Inbox in Heirloom. They need to sign in with that Google email.</p>
            {invites.length > 0 && (
              <ul className="flex flex-col">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-2 text-sm text-stone-800 border-t border-stone-200 first:border-t-0">
                    <span className="truncate py-2">Sent to {invite.toEmail}</span>
                    <button
                      type="button"
                      aria-label={`Unsend to ${invite.toEmail}`}
                      onClick={() =>
                        run(
                          'send',
                          async () => {
                            await removeInvite(invite);
                            setInvites((list) => list.filter((i) => i.id !== invite.id));
                          },
                          'Could not unsend. Try again.'
                        )
                      }
                      className="hit-area min-h-11 min-w-11 flex items-center justify-center text-stone-500 hover:text-stone-900"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {editedSinceShared && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/50 p-3 text-sm text-amber-900 dark:text-amber-100 flex flex-col gap-2">
              <p>You have edited this recipe since you shared it. People who open the link still see the older version.</p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run('refresh', async () => setShare(await refresh(share)), 'Could not update the shared copy. Try again.')}
                className="self-start min-h-11 px-4 rounded-xl bg-ink hover:bg-ink-hover disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
                Update the shared copy
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setConfirmingStop(true)}
            className="self-start min-h-11 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:underline"
          >
            Stop sharing this recipe
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      <ConfirmSheet
        open={confirmingStop}
        title="Stop sharing?"
        message="The link will stop working right away. People who already saved a copy keep it."
        confirmLabel="Stop sharing"
        destructive
        busy={busy === 'stop'}
        onCancel={() => setConfirmingStop(false)}
        onConfirm={() =>
          run(
            'stop',
            async () => {
              if (share) await stop(share);
              setShare(null);
              setConfirmingStop(false);
            },
            'Could not stop sharing. Try again.'
          )
        }
      />
    </Sheet>
  );
};
