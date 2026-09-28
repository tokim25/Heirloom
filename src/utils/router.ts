import { useSyncExternalStore } from 'react';

/*
 * A tiny History API router. Heirloom has few screens, so this replaces a router library:
 *   /               Recipes
 *   /groceries      Groceries
 *   /add            Add a recipe (sheet over the current tab)
 *   /profile        Profile (sheet over the current tab)
 *   /r/:recipeId    A recipe (sheet over Recipes)
 * Vercel already serves index.html for every non-API path, so all of these work as links.
 */

const CHANGE_EVENT = 'heirloom:navigate';

/** Marks history entries this app created, so "back" never leaves the site. */
const ENTRY_MARKER = { heirloom: true };

const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
};

const normalize = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname) || '/';

export const getPath = () => normalize(window.location.pathname);

/** Current path, re-rendering the component whenever it changes. */
export const usePath = () => useSyncExternalStore(subscribe, getPath, () => '/');

/** Goes to a path (optionally with a query string), adding a history entry unless `replace` is set. */
export function navigate(to: string, options: { replace?: boolean } = {}) {
  const url = new URL(to, window.location.origin);
  const target = normalize(url.pathname) + url.search;
  if (target === getPath() + window.location.search) return;
  if (options.replace) window.history.replaceState(ENTRY_MARKER, '', target);
  else window.history.pushState(ENTRY_MARKER, '', target);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Closes an overlay route. If this app opened it (so Back is inside Heirloom) it goes back;
 * if the user landed on it directly from a link, it goes to `fallback` instead of leaving the site.
 * Does nothing when the overlay is no longer the current route, which makes it safe to call
 * after something else (like saving a recipe) has already navigated away.
 */
export function closeOverlay(overlayPath: string, fallback = '/') {
  if (getPath() !== overlayPath && !getPath().startsWith(overlayPath + '/')) return;
  if (window.history.state?.heirloom) window.history.back();
  else navigate(fallback, { replace: true });
}

export const recipePath = (id: string) => `/r/${encodeURIComponent(id)}`;

/** The recipe id in `/r/:id`, or null. */
export const recipeIdFromPath = (path: string): string | null => {
  const match = path.match(/^\/r\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};
