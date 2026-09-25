import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use the databaseId provisioned in firebase-applet-config.json
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Standard Google Sign-In Provider (email, profile, openid ONLY)
// Never triggers scary unverified/drive warnings during standard login
export const googleSignInProvider = new GoogleAuthProvider();
googleSignInProvider.setCustomParameters({
  prompt: 'select_account',
});

// Dedicated Google Drive Backup Provider (incremental drive.file scope)
// Only requested when explicitly backing up or restoring recipes in Drive Vault
export const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleDriveProvider.setCustomParameters({
  prompt: 'consent',
});

// Backward compatibility alias
export const googleAuthProvider = googleSignInProvider;

export { collection, doc, setDoc, getDocs, onSnapshot, updateDoc, deleteDoc };
export default app;
