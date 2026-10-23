import React, { useState } from 'react';
import { BookOpen, ShoppingBag, Sparkles } from 'lucide-react';
import { Sprout } from './ui/Sprout.tsx';

interface WelcomeScreenProps {
  onSignIn: () => Promise<void>;
  errorMessage: string | null;
}

const FEATURES = [
  { icon: Sparkles, title: 'Bring recipes in from anywhere', body: 'Links, videos, photos of recipe cards and PDFs become clean, cookable recipes.' },
  { icon: BookOpen, title: 'Keep them on every device', body: 'Your cookbook syncs on its own, with an optional copy in Google Drive.' },
  { icon: ShoppingBag, title: 'Shop together', body: 'Share one grocery list with your household and shop it at your store.' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSignIn, errorMessage }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await onSignIn();
    } catch {
      // The error message is shown from auth context.
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <section className="max-w-md mx-auto px-4 pt-10 sm:pt-16 pb-12 flex flex-col gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Sprout size={64} className="text-stone-800" />
        <h1 className="font-serif text-4xl text-stone-900">Preserve the recipe. Share the table.</h1>
        <p className="text-base text-stone-600">Your family's cookbook, on every device.</p>
      </div>

      {/* One sample card shows what a kept recipe feels like: a person, not a URL. */}
      <figure className="rounded-2xl bg-surface border border-stone-200/80 shadow-[0_8px_30px_rgba(43,53,62,0.08)] px-6 py-5 flex flex-col gap-1">
        <figcaption className="font-hand text-2xl text-amber-700 -mb-1">from Halmoni's kitchen</figcaption>
        <p className="font-serif text-2xl text-stone-900">Sesame Noodles</p>
        <p className="text-sm text-stone-600">Serves 4 · 20 minutes · "Add the sesame oil last, always."</p>
      </figure>

      <ul className="flex flex-col gap-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center dark:bg-amber-900/40 dark:text-amber-200">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold text-stone-900">{title}</p>
              <p className="text-sm text-stone-600">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="h-12 w-full rounded-xl bg-ink hover:bg-ink-hover disabled:bg-stone-500 text-white text-base font-semibold flex items-center justify-center gap-3 shadow-sm"
        >
          <svg className="w-5 h-5 bg-surface rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {isSigningIn ? 'Signing in…' : 'Continue with Google'}
        </button>
        {errorMessage && (
          <p role="alert" className="text-sm text-rose-700 text-center dark:text-rose-300">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
};
