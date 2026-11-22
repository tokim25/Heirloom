import { useSyncExternalStore } from 'react';

/*
 * A tiny History API router. Heirloom has few screens, so this replaces a router library:
 *   /               Recipes
 *   /groceries      Groceries
 *   /add            Add a recipe (sheet over the current tab)
 *   /profile        Profile (sheet over the current tab)
 *   /plan           Weekly meal plan (sheet over the current tab)
 *   /inbox          Recipes sent to you (sheet over the current tab)
 *   /r/:recipeId    A recipe (sheet over Recipes)
 *   /s/:shareId     A recipe someone shared (sheet)
 *   /join/:code     An invite to join someone's household (sheet)
 *   /cook/:recipeId Cooking mode (full screen). ?servings=6&units=metric keep the amounts you chose.
 *   /shop/:listId   Shopping for a list (sheet over Groceries)
 * Anything that covers the screen has its own address, so Back always closes the thing on top.
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

export const sharePath = (id: string) => `/s/${encodeURIComponent(id)}`;

/** The share id in `/s/:id`, or null. */
export const shareIdFromPath = (path: string): string | null => {
  const match = path.match(/^\/s\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

export const joinPath = (code: string) => `/join/${encodeURIComponent(code)}`;

/** The invite code in `/join/:code`, or null. */
export const joinCodeFromPath = (path: string): string | null => {
  const match = path.match(/^\/join\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

/** `/cook/:id`, carrying the servings and units chosen on the recipe. */
export const cookPath = (id: string, servings?: number, units?: 'imperial' | 'metric') => {
  const query = new URLSearchParams();
  if (servings) query.set('servings', String(servings));
  if (units === 'metric') query.set('units', 'metric');
  const search = query.toString();
  return `/cook/${encodeURIComponent(id)}${search ? `?${search}` : ''}`;
};

/** The recipe id in `/cook/:id`, or null. */
export const cookIdFromPath = (path: string): string | null => {
  const match = path.match(/^\/cook\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

export const shopPath = (listId: string) => `/shop/${encodeURIComponent(listId)}`;

/** The grocery list id in `/shop/:id`, or null. */
export const shopIdFromPath = (path: string): string | null => {
  const match = path.match(/^\/shop\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};
