import React, { useState } from 'react';
import { Cloud, CloudDownload, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Sheet } from './ui/Sheet.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  googleDriveService,
  DriveAuthError,
  DRIVE_LIBRARY_FILE_NAME,
  HeirloomDrivePayload,
} from '../utils/googleDriveService.ts';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  copyStatus: { lastCopiedAt: string | null; error: string | null };
  onRestore: (payload: HeirloomDrivePayload) => Promise<number>;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  copyStatus,
  onRestore,
}) => {
  const {
    user,
    googleAccessToken,
    isDriveCopyEnabled,
    connectGoogleDrive,
    disconnectGoogleDrive,
    markDriveTokenExpired,
  } = useAuth();
  const [busy, setBusy] = useState<'connect' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const needsReconnect = isDriveCopyEnabled && !googleAccessToken;

  const handleConnect = async () => {
    setBusy('connect');
    setMessage(null);
    try {
      await connectGoogleDrive();
      setMessage({ type: 'success', text: `Drive copy is on. Heirloom will keep "${DRIVE_LIBRARY_FILE_NAME}" up to date.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Could not connect Google Drive.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!googleAccessToken || !user) return;
    setBusy('restore');
    setMessage(null);
    try {
      const payload = await googleDriveService.readLibrary(googleAccessToken, user.householdId);
      if (!payload) {
        setMessage({ type: 'error', text: `No "${DRIVE_LIBRARY_FILE_NAME}" file was found in your Drive yet.` });
        return;
      }
      const restored = await onRestore(payload);
      setMessage({
        type: 'success',
        text: restored === 0 ? 'Your cookbook already matches the Drive copy.' : `Restored ${restored} recipes from Drive.`,
      });
    } catch (err: any) {
      if (err instanceof DriveAuthError) markDriveTokenExpired();
      setMessage({ type: 'error', text: err?.message || 'Could not read the Drive copy.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Google Drive copy"
      description="Your recipes, saved to your own Drive."
      size="md"
    >
        <p className="text-sm text-stone-700 leading-relaxed">
          Your cookbook syncs across your devices automatically. When the Drive copy is on, Heirloom also keeps one file,
          <span className="font-semibold"> {DRIVE_LIBRARY_FILE_NAME}</span>, updated in your Google Drive while you use the app.
        </p>

        <div className="rounded-2xl bg-white border border-stone-200 p-4 text-sm flex items-start gap-3">
          {isDriveCopyEnabled && googleAccessToken ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-stone-900">On</p>
                <p className="text-stone-600">
                  {copyStatus.lastCopiedAt ? `Last copied ${formatTime(copyStatus.lastCopiedAt)}` : 'Copying shortly…'}
                </p>
              </div>
            </>
          ) : needsReconnect ? (
            <>
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-stone-900">Paused</p>
                <p className="text-stone-600">Google limits Drive access to about an hour. Reconnect to resume copying.</p>
              </div>
            </>
          ) : (
            <>
              <Cloud className="w-5 h-5 text-stone-400 shrink-0" />
              <div>
                <p className="font-semibold text-stone-900">Off</p>
                <p className="text-stone-600">Heirloom can only see files it creates in your Drive.</p>
              </div>
            </>
          )}
        </div>

        {copyStatus.error && isDriveCopyEnabled && (
          <p className="text-sm text-rose-700">{copyStatus.error}</p>
        )}
        {message && (
          <p role="status" className={`text-sm ${message.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
            {message.text}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {(!isDriveCopyEnabled || needsReconnect) && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy !== null || !user}
              className="h-12 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-base font-semibold flex items-center justify-center gap-2"
            >
              {busy === 'connect' && <RefreshCw className="w-4 h-4 animate-spin" />}
              {needsReconnect ? 'Reconnect Google Drive' : 'Turn on Drive copy'}
            </button>
          )}
          {isDriveCopyEnabled && googleAccessToken && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy !== null}
              className="h-12 rounded-xl bg-white border border-stone-300 text-stone-900 text-base font-semibold flex items-center justify-center gap-2 hover:bg-stone-50"
            >
              {busy === 'restore' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              Restore missing recipes from Drive
            </button>
          )}
          {isDriveCopyEnabled && (
            <button
              type="button"
              onClick={disconnectGoogleDrive}
              className="h-11 rounded-xl text-stone-600 text-sm font-semibold hover:bg-stone-100"
            >
              Turn off Drive copy
            </button>
          )}
        </div>
    </Sheet>
  );
};
