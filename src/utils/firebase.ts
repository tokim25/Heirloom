import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Set VITE_FIREBASE_AUTH_DOMAIN to the app's own domain (e.g. heirloom.tonykim.io) once
// vercel.json proxies /__/auth/* to Firebase. Same-origin auth is what makes sign-in
// work in iOS Safari and the installed PWA, which block third-party storage.
const customAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const resolvedFirebaseConfig = {
  ...firebaseConfig,
  authDomain: customAuthDomain || firebaseConfig.authDomain,
};

const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

// Firestore is the single source of truth. The persistent cache keeps the cookbook
// readable offline and queues writes until the device reconnects.
const createDb = (): Firestore => {
  const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true,
      },
      databaseId
    );
  } catch {
    // Already initialized (e.g. HMR) or IndexedDB unavailable.
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
};

export const db = createDb();
export const auth = getAuth(app);

// Sign-in asks for identity only. Drive access is requested separately, when the
// user turns on the Drive copy, so sign-in never shows a Drive consent screen.
export const googleSignInProvider = new GoogleAuthProvider();
googleSignInProvider.setCustomParameters({ prompt: 'select_account' });

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope(DRIVE_FILE_SCOPE);
googleDriveProvider.setCustomParameters({ include_granted_scopes: 'true' });

export default app;
