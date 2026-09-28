import React, { useState } from 'react';
import { BookOpen, ShoppingBag, Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  onSignIn: () => Promise<void>;
  errorMessage: string | null;
}

const FEATURES = [
  { icon: Sparkles, title: 'Import from anywhere', body: 'Links, videos, photos of recipe cards, and PDFs become clean recipes.' },
  { icon: BookOpen, title: 'On every device', body: 'Your cookbook syncs automatically, with an optional copy in Google Drive.' },
  { icon: ShoppingBag, title: 'Shop together', body: 'Share grocery lists with your household, then shop them at your store on Instacart.' },
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
    <section className="max-w-md mx-auto px-4 pt-12 sm:pt-20 pb-12 flex flex-col gap-8">
      <div className="flex flex-col gap-3 text-center">
        <h1 className="font-serif text-4xl text-stone-900 tracking-tight">Your family cookbook, on every device.</h1>
        <p className="text-base text-stone-600">Preserve the recipe. Share the table.</p>
      </div>

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
