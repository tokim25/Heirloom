import React from 'react';
import { ChefHat, Inbox } from 'lucide-react';
import { ShareInvite } from '../types/recipe.ts';
import { timeAgo } from '../utils/inbox.ts';
import { Sheet } from './ui/Sheet.tsx';

interface InboxSheetProps {
  invites: ShareInvite[];
  onView: (invite: ShareInvite) => void;
  onDismiss: (invite: ShareInvite) => void;
  onClose: () => void;
}

/** Recipes other Heirloom users have sent to this account's email. */
export const InboxSheet: React.FC<InboxSheetProps> = ({ invites, onView, onDismiss, onClose }) => (
  <Sheet
    open
    onClose={onClose}
    title="Inbox"
    description={invites.length ? 'Recipes people sent you.' : undefined}
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
    {invites.length === 0 ? (
      <div className="flex flex-col items-center text-center gap-2 py-8">
        <Inbox className="w-8 h-8 text-stone-400" aria-hidden="true" />
        <p className="text-base font-semibold text-stone-900">Nothing here yet</p>
        <p className="text-sm text-stone-600 max-w-xs">
          When someone on Heirloom sends you a recipe, it shows up here. You can also ask them to send it to your Google email.
        </p>
      </div>
    ) : (
      <ul className="flex flex-col gap-3">
        {invites.map((invite) => (
          <li key={invite.id} className="rounded-2xl border border-stone-200 bg-surface p-3 flex items-center gap-3">
            {invite.heroImage ? (
              <img src={invite.heroImage} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                <ChefHat className="w-6 h-6 text-stone-400" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-stone-900 truncate">{invite.recipeTitle}</p>
              <p className="text-sm text-stone-600 truncate">
                From {invite.fromName} · {timeAgo(invite.createdAt)}
              </p>
              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onView(invite)}
                  className="min-h-11 px-4 rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-semibold"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(invite)}
                  className="min-h-11 px-3 text-sm font-semibold text-stone-600 hover:text-stone-900"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </Sheet>
);
