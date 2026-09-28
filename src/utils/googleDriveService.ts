/**
 * Google Drive copy of the cookbook.
 *
 * Firestore is the source of truth. Drive holds one file, "Heirloom Recipes.json", that is
 * rewritten in place whenever the cookbook changes while Drive access is active. Uses the
 * least-privilege drive.file scope, so Heirloom can only see files it created.
 */

import { Recipe, GroceryList } from '../types/recipe.ts';

export const DRIVE_LIBRARY_FILE_NAME = 'Heirloom Recipes.json';

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface HeirloomDrivePayload {
  version: string;
  appName: string;
  exportedAt: string;
  recipes: Recipe[];
  groceryLists: GroceryList[];
}

export class DriveAuthError extends Error {}

const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_FIELDS = 'id,name,modifiedTime,webViewLink';

const driveFetch = async (token: string, url: string, init: RequestInit = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new DriveAuthError('Google Drive access expired. Reconnect Drive to keep your copy up to date.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Google Drive request failed (${res.status}).`);
  }
  return res;
};

const fileIdKey = (householdId: string) => `heirloom_drive_file_${householdId}`;

export const googleDriveService = {
  async findLibraryFile(token: string, householdId: string): Promise<DriveFile | null> {
    const cachedId = localStorage.getItem(fileIdKey(householdId));
    if (cachedId) {
      try {
        const res = await driveFetch(token, `${FILES_ENDPOINT}/${cachedId}?fields=${FILE_FIELDS},trashed`);
        const file = await res.json();
        if (!file.trashed) return file;
      } catch (err) {
        if (err instanceof DriveAuthError) throw err;
      }
      localStorage.removeItem(fileIdKey(householdId));
    }
    const q = encodeURIComponent(`name = '${DRIVE_LIBRARY_FILE_NAME}' and trashed = false`);
    const res = await driveFetch(token, `${FILES_ENDPOINT}?q=${q}&orderBy=modifiedTime desc&fields=files(${FILE_FIELDS})`);
    const { files } = await res.json();
    const file = files?.[0] || null;
    if (file) localStorage.setItem(fileIdKey(householdId), file.id);
    return file;
  },

  /** Creates or overwrites the single library file with the current cookbook. */
  async writeLibrary(
    token: string,
    householdId: string,
    recipes: Recipe[],
    groceryLists: GroceryList[]
  ): Promise<DriveFile> {
    const payload: HeirloomDrivePayload = {
      version: '2.0.0',
      appName: 'Heirloom',
      exportedAt: new Date().toISOString(),
      recipes,
      groceryLists,
    };
    const body = JSON.stringify(payload, null, 2);
    const existing = await this.findLibraryFile(token, householdId);

    if (existing) {
      const res = await driveFetch(token, `${UPLOAD_ENDPOINT}/${existing.id}?uploadType=media&fields=${FILE_FIELDS}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return res.json();
    }

    const boundary = `heirloom-${crypto.randomUUID()}`;
    const metadata = {
      name: DRIVE_LIBRARY_FILE_NAME,
      mimeType: 'application/json',
      description: 'Automatic copy of your Heirloom cookbook. Heirloom keeps this file up to date.',
    };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const res = await driveFetch(token, `${UPLOAD_ENDPOINT}?uploadType=multipart&fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
    const file = await res.json();
    localStorage.setItem(fileIdKey(householdId), file.id);
    return file;
  },

  async readLibrary(token: string, householdId: string): Promise<HeirloomDrivePayload | null> {
    const file = await this.findLibraryFile(token, householdId);
    if (!file) return null;
    const res = await driveFetch(token, `${FILES_ENDPOINT}/${file.id}?alt=media`);
    return res.json();
  },
};
