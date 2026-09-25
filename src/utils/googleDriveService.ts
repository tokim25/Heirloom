/**
 * Google Drive Backup & Storage Service for Mise
 * Uses Google Drive REST API v3 with least-privilege 'drive.file' scope.
 * 
 * Safety Guideline: Destructive or mutating file actions require user confirmation.
 */

import { Recipe, GroceryList, PantryItem } from '../types/recipe.ts';

export interface DriveBackupFile {
  id: string;
  name: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface MiseBackupPayload {
  version: string;
  appName: string;
  exportedAt: string;
  recipes: Recipe[];
  groceryLists: GroceryList[];
  pantryItems: PantryItem[];
  metadata: {
    recipeCount: number;
    listCount: number;
    pantryCount: number;
  };
}

export type HeirloomBackupPayload = MiseBackupPayload;

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export const googleDriveService = {
  /**
   * Search for existing Heirloom & legacy Mise backups on the user's Google Drive
   */
  async listBackups(accessToken: string): Promise<DriveBackupFile[]> {
    try {
      const query = encodeURIComponent("(name contains 'heirloom-recipe-backup' or name contains 'mise-recipe-backup') and trashed = false");
      const url = `${DRIVE_FILES_ENDPOINT}?q=${query}&orderBy=createdTime desc&fields=files(id,name,size,createdTime,modifiedTime,webViewLink)`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Google Drive authorization expired. Please sign in again.');
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Failed to fetch backups (${response.status})`);
      }

      const data = await response.json();
      return (data.files as DriveBackupFile[]) || [];
    } catch (err: any) {
      console.error('Google Drive listBackups error:', err);
      throw err;
    }
  },

  /**
   * Create a new backup snapshot file in Google Drive
   */
  async createBackup(
    accessToken: string,
    recipes: Recipe[],
    groceryLists: GroceryList[],
    pantryItems: PantryItem[]
  ): Promise<DriveBackupFile> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `heirloom-recipe-backup-${timestamp}.json`;

    const payload: HeirloomBackupPayload = {
      version: '1.2.0',
      appName: 'Heirloom — Preserve the recipe. Share the table.',
      exportedAt: new Date().toISOString(),
      recipes,
      groceryLists,
      pantryItems,
      metadata: {
        recipeCount: recipes.length,
        listCount: groceryLists.length,
        pantryCount: pantryItems.length,
      },
    };

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: `Heirloom Recipe Archive Backup containing ${recipes.length} recipes and ${pantryItems.length} pantry items.`,
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload, null, 2) +
      closeDelimiter;

    const response = await fetch(DRIVE_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to create Drive backup (${response.status})`);
    }

    const createdFile = await response.json();
    return createdFile as DriveBackupFile;
  },

  /**
   * Download and parse a backup file from Google Drive
   */
  async downloadBackup(accessToken: string, fileId: string): Promise<MiseBackupPayload> {
    const url = `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download backup file (${response.status})`);
    }

    const json = await response.json();
    return json as MiseBackupPayload;
  },

  /**
   * Delete a backup file from Google Drive (user confirmed)
   */
  async deleteBackup(accessToken: string, fileId: string): Promise<void> {
    const url = `${DRIVE_FILES_ENDPOINT}/${fileId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete backup file (${response.status})`);
    }
  },
};
