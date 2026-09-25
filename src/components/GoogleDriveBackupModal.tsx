import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  Cloud,
  CloudUpload,
  CloudDownload,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  FileText,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Recipe, GroceryList, PantryItem } from '../types/recipe.ts';
import { googleDriveService, DriveBackupFile, MiseBackupPayload } from '../utils/googleDriveService.ts';
import { sounds } from '../utils/sound.ts';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  groceryLists: GroceryList[];
  pantryItems: PantryItem[];
  onRestoreBackup: (payload: MiseBackupPayload) => void;
}

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  recipes,
  groceryLists,
  pantryItems,
  onRestoreBackup,
}) => {
  const { googleAccessToken, connectGoogleDrive, disconnectGoogleDrive, isGoogleConnected, user } = useAuth();
  
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDomainError, setIsDomainError] = useState(false);

  // Confirmation dialog state (MANDATORY per Workspace guidelines)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    confirmVariant: 'primary' | 'danger';
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Load backups when token is available
  useEffect(() => {
    if (isOpen && googleAccessToken) {
      loadBackups();
    }
  }, [isOpen, googleAccessToken]);

  const loadBackups = async () => {
    if (!googleAccessToken) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const list = await googleDriveService.listBackups(googleAccessToken);
      setBackups(list);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to list backups from Google Drive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setStatusMessage(null);
      setIsDomainError(false);
      await connectGoogleDrive();
    } catch (err: any) {
      const unauthorized =
        err?.code === 'auth/unauthorized-domain' ||
        err?.message?.includes('auth/unauthorized-domain');
      if (unauthorized) {
        setIsDomainError(true);
        setStatusMessage({
          type: 'error',
          text: 'Firebase requires your custom domain (heirloom.tonykim.io) to be added to Authorized Domains in your Firebase Console.',
        });
      } else {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to connect Google Drive' });
      }
    }
  };

  const triggerBackupWithConfirmation = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Back Up Recipes to Google Drive?',
      description: `This will create a new cloud archive containing ${recipes.length} recipes, ${groceryLists.length} grocery lists, and ${pantryItems.length} pantry staples in your personal Google Drive.`,
      confirmText: 'Confirm & Back Up',
      confirmVariant: 'primary',
      onConfirm: async () => {
        if (!googleAccessToken) return;
        setIsBackingUp(true);
        setStatusMessage(null);
        try {
          const newFile = await googleDriveService.createBackup(
            googleAccessToken,
            recipes,
            groceryLists,
            pantryItems
          );
          sounds.playCheckTick();
          setStatusMessage({ type: 'success', text: `Successfully saved backup to Google Drive!` });
          setBackups((prev) => [newFile, ...prev]);
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message || 'Failed to create backup' });
        } finally {
          setIsBackingUp(false);
        }
      },
    });
  };

  const triggerRestoreWithConfirmation = (backup: DriveBackupFile) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restore Recipes from Google Drive?',
      description: `This will download "${backup.name}" and merge restored recipes and ingredients into your Heirloom recipe library. Existing recipes with identical IDs will be safely synchronized.`,
      confirmText: 'Restore Recipes',
      confirmVariant: 'primary',
      onConfirm: async () => {
        if (!googleAccessToken) return;
        setRestoringFileId(backup.id);
        setStatusMessage(null);
        try {
          const payload = await googleDriveService.downloadBackup(googleAccessToken, backup.id);
          onRestoreBackup(payload);
          sounds.playPartnerNotification();
          setStatusMessage({
            type: 'success',
            text: `Restored ${payload.recipes?.length || 0} recipes from "${backup.name}"!`,
          });
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message || 'Failed to restore backup' });
        } finally {
          setRestoringFileId(null);
        }
      },
    });
  };

  const triggerDeleteWithConfirmation = (backup: DriveBackupFile) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Backup from Google Drive?',
      description: `Are you sure you want to permanently delete "${backup.name}" from your Google Drive? This action cannot be undone.`,
      confirmText: 'Permanently Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        if (!googleAccessToken) return;
        setStatusMessage(null);
        try {
          await googleDriveService.deleteBackup(googleAccessToken, backup.id);
          setBackups((prev) => prev.filter((b) => b.id !== backup.id));
          setStatusMessage({ type: 'success', text: 'Backup file removed from Google Drive.' });
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message || 'Failed to delete backup' });
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FAF9F5] w-full max-w-xl rounded-3xl border border-stone-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200/80 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-stone-900 leading-tight">
                Google Drive Vault
              </h2>
              <p className="text-xs text-stone-500">
                User file storage, snapshot backups & recovery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`px-6 py-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5 flex-1">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>

            <div className="flex items-center gap-2">
              {isDomainError && (
                <a
                  href="https://console.firebase.google.com/project/nth-imagery-298121/authentication/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-medium text-[11px] transition-colors"
                >
                  <span>Authorize Domain in Firebase</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={() => {
                  setStatusMessage(null);
                  setIsDomainError(false);
                }}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Connection Card */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isGoogleConnected ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-stone-300'}`} />
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  {isGoogleConnected ? 'Connected to Google Drive' : 'Google Drive Disconnected'}
                </h3>
                <p className="text-xs text-stone-500">
                  {isGoogleConnected
                    ? `Authenticated as ${user?.email || 'Active User'}`
                    : 'Sign in to access your private Heirloom Recipe Vault'}
                </p>
              </div>
            </div>

            {isGoogleConnected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={loadBackups}
                  disabled={isLoading}
                  className="p-2 rounded-xl text-stone-500 hover:bg-stone-100 transition-colors border border-stone-200/70"
                  title="Refresh Backups"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
                </button>
                <button
                  onClick={disconnectGoogleDrive}
                  className="text-xs text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-xl border border-stone-200/70 hover:bg-stone-50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Cloud className="w-4 h-4 text-amber-400" />
                <span>Connect Google Drive</span>
              </button>
            )}
          </div>

          {/* Action Card: Backup Now */}
          {isGoogleConnected && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/5 to-amber-500/15 border border-amber-500/20 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-stone-950">
                  Create Instant Cloud Snapshot
                </h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  Saves your complete library: {recipes.length} recipes, meal plans, and pantry lists.
                </p>
              </div>
              <button
                onClick={triggerBackupWithConfirmation}
                disabled={isBackingUp}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
              >
                <CloudUpload className="w-4 h-4" />
                <span>{isBackingUp ? 'Backing up...' : 'Back Up Now'}</span>
              </button>
            </div>
          )}

          {/* Backup History List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Cloud Backups on Drive ({backups.length})
              </h4>
              {backups.length > 0 && (
                <span className="text-[11px] text-stone-400">
                  Least-privilege 'drive.file' scope
                </span>
              )}
            </div>

            {!isGoogleConnected ? (
              <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50">
                <HardDrive className="w-8 h-8 text-stone-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-stone-600">
                  Connect your Google Drive account above to store and view your cookbook backups.
                </p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-10">
                <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-stone-500">Scanning Google Drive for Heirloom archives...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50">
                <FileText className="w-8 h-8 text-stone-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-stone-700">No previous backups found on Google Drive</p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Click "Back Up Now" above to create your first cloud snapshot.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center justify-between gap-3 hover:border-stone-300 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-semibold text-stone-900 truncate">
                          {backup.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          {new Date(backup.createdTime).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        {backup.size && (
                          <span>{(parseInt(backup.size, 10) / 1024).toFixed(1)} KB</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {backup.webViewLink && (
                        <a
                          href={backup.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
                          title="Open file in Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => triggerRestoreWithConfirmation(backup)}
                        disabled={restoringFileId === backup.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-amber-50 hover:text-amber-900 border border-stone-200 rounded-xl text-xs font-semibold transition-colors"
                        title="Restore recipes from this backup"
                      >
                        <CloudDownload className="w-3.5 h-3.5 text-amber-600" />
                        <span>{restoringFileId === backup.id ? 'Restoring...' : 'Restore'}</span>
                      </button>
                      <button
                        onClick={() => triggerDeleteWithConfirmation(backup)}
                        className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete backup from Drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy & Safety Guarantee */}
          <div className="p-3.5 rounded-xl bg-stone-100/70 border border-stone-200/60 flex items-start gap-2.5 text-[11px] text-stone-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong>Least-Privilege Security:</strong> Heirloom only requests access to files that it creates (<code>drive.file</code> scope). It can never see or modify other personal documents or photos in your Google Drive.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200/80 flex items-center justify-end bg-stone-50/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-serif text-lg font-bold text-stone-950">
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-stone-600 mt-2 leading-relaxed">
              {confirmDialog.description}
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const onConf = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await onConf();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-all ${
                  confirmDialog.confirmVariant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
