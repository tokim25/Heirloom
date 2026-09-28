import { auth } from './firebase.ts';

/**
 * fetch() for Heirloom's own /api routes. Attaches the signed-in user's Firebase ID token,
 * which the server verifies before calling Gemini.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Sign in with Google to use this feature.');
  }
  const idToken = await current.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  });
}

/** Reads `{ error }` from a failed response without throwing on non-JSON bodies (e.g. a 413 page). */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  if (res.status === 413) return 'That file is too large to upload. Try a smaller photo or PDF (under 3 MB).';
  if (res.status === 401) return 'Your session expired. Sign in again and retry.';
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}
