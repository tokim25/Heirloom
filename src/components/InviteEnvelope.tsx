import React from 'react';
import { ShareInvite } from '../types/recipe.ts';
import { timeAgo } from '../utils/inbox.ts';
import { Sprout } from './ui/Sprout.tsx';

interface InviteEnvelopeProps {
  invite: ShareInvite;
  opening: boolean;
  onOpen: () => void;
}

/** A recipe nobody has opened yet, shown as a sealed envelope. Tapping it plays the opening (see index.css). */
export const InviteEnvelope: React.FC<InviteEnvelopeProps> = ({ invite, opening, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    disabled={opening}
    data-open={opening}
    aria-label={`Open the recipe ${invite.recipeTitle} from ${invite.fromName}`}
    className="envelope"
  >
    <span className="envelope-letter">
      {invite.note ? (
        <span className="block font-hand text-2xl leading-tight text-stone-800 line-clamp-2">{invite.note}</span>
      ) : (
        <span className="block font-serif text-xl leading-tight text-stone-900 line-clamp-2">{invite.recipeTitle}</span>
      )}
      <span className="block mt-1 text-sm text-stone-600">{invite.note ? invite.recipeTitle : 'A recipe for you'}</span>
    </span>
    <span className="envelope-body">
      <span className="font-hand text-2xl leading-none text-amber-700">from {invite.fromName}</span>
      <span className="block text-sm text-stone-600 truncate">
        {invite.recipeTitle} · {timeAgo(invite.createdAt)}
      </span>
    </span>
    <span className="envelope-flap" aria-hidden="true" />
    <span className="envelope-seal" aria-hidden="true">
      <Sprout size={22} animate={false} className="text-[var(--color-on-accent)]" />
    </span>
  </button>
);
