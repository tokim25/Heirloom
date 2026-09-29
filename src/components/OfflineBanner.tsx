import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

/** True while the browser reports a connection. */
export const useOnline = (): boolean => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const unsubscribe = subscribe(update);
    update();
    return unsubscribe;
  }, []);
  return online;
};

/** Tells people why AI import and sharing are unavailable, and that their edits are safe. */
export const OfflineBanner: React.FC = () => {
  const online = useOnline();
  const [justReconnected, setJustReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      return;
    }
    if (!wasOffline) return;
    setJustReconnected(true);
    const id = window.setTimeout(() => {
      setJustReconnected(false);
      setWasOffline(false);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [online]);

  if (online && !justReconnected) return null;
  return (
    <div
      role="status"
      className={`w-full px-4 py-2 text-sm text-center flex items-center justify-center gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] ${
        online ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
      }`}
    >
      {!online && <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />}
      {online ? 'Back online. Your changes are syncing.' : "You're offline. Your recipes and lists still work, and changes sync when you reconnect."}
    </div>
  );
};
