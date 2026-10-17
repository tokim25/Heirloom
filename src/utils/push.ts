import app from './firebase.ts';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Client side of push notifications: asking permission, getting this device's address from Firebase Cloud
 * Messaging, and reporting what the device can do. The Firebase messaging code is loaded only when needed.
 */

const VAPID_KEY: string = import.meta.env.VITE_FIREBASE_VAPID_KEY || (firebaseConfig as { vapidKey?: string }).vapidKey || '';

/** False until the Firebase web push key has been added, so the Profile screen stays quiet until it can work. */
export const pushConfigured = VAPID_KEY.length > 0;

export type PushSupport = 'unsupported' | 'needs_install' | 'blocked' | 'off' | 'on';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** What this device can do right now. iPhones only receive notifications once Heirloom is on the Home Screen. */
export function pushSupport(hasDevice: boolean): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !isStandalone() ? 'needs_install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'granted' && hasDevice) return 'on';
  return 'off';
}

const tokenKey = async (token: string): Promise<string> => {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
};

export interface RegisteredDevice {
  key: string;
  token: string;
  timeZone: string;
}

/** Asks permission and returns this device's push address, or throws a message fit to show the person. */
export async function registerDevice(): Promise<RegisteredDevice> {
  if (!pushConfigured) throw new Error('Notifications are not set up yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can change this in your phone or browser settings.');
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) throw new Error('This browser cannot receive notifications.');
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Could not turn on notifications. Try again.');
  return { key: await tokenKey(token), token, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
}

/** Stops this device from receiving anything and returns the key to remove from the account. */
export async function unregisterDevice(): Promise<string | null> {
  try {
    const { getMessaging, getToken, deleteToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return null;
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => '');
    await deleteToken(messaging).catch(() => undefined);
    return token ? await tokenKey(token) : null;
  } catch {
    return null;
  }
}

/** This device's own key, if it is registered, so the Profile screen can tell "this phone" from a partner's. */
export async function currentDeviceKey(): Promise<string | null> {
  if (!pushConfigured || Notification.permission !== 'granted') return null;
  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return null;
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    return token ? await tokenKey(token) : null;
  } catch {
    return null;
  }
}
