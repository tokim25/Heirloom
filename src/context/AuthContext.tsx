import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Household, User } from '../types/recipe.ts';
import { auth, googleSignInProvider, googleDriveProvider } from '../utils/firebase.ts';
import { firestoreService } from '../utils/firestoreService.ts';
import { closeOverlay, navigate, usePath } from '../utils/router.ts';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  linkWithPopup,
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  household: Household | null;
  isAuthLoading: boolean;
  isGoogleSignedIn: boolean;
  /** Valid (unexpired) Drive access token, if the user turned on the Drive copy. */
  googleAccessToken: string | null;
  isGoogleConnected: boolean;
  isDriveCopyEnabled: boolean;
  signInWithGoogle: () => Promise<void>;
  connectGoogleDrive: () => Promise<string | null>;
  disconnectGoogleDrive: () => void;
  markDriveTokenExpired: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  logout: () => Promise<void>;
  authErrorMessage: string | null;
  clearAuthError: () => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  isDriveModalOpen: boolean;
  setIsDriveModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google access tokens from Firebase last ~1 hour and cannot be refreshed client-side.
// Store the expiry so we stop using a dead token and prompt a quick reconnect instead.
const DRIVE_TOKEN_KEY = 'heirloom_drive_token';
const DRIVE_ENABLED_KEY = 'heirloom_drive_copy_enabled';
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

const readDriveToken = (): string | null => {
  try {
    const raw = localStorage.getItem(DRIVE_TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    return typeof token === 'string' && Date.now() < expiresAt ? token : null;
  } catch {
    return null;
  }
};

const writeDriveToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify({ token, expiresAt: Date.now() + TOKEN_LIFETIME_MS }));
  } else {
    localStorage.removeItem(DRIVE_TOKEN_KEY);
  }
};

// Popups open outside an installed iOS/Android PWA and never return, so use redirect there.
const isStandalonePwa = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

const describeAuthError = (err: any): string => {
  switch (err?.code) {
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in yet. Add it under Firebase Console > Authentication > Settings > Authorized domains.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/network-request-failed':
      return 'No connection. Check your network and try again.';
    default:
      return err?.message || 'Google sign-in failed. Please try again.';
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => readDriveToken());
  const [isDriveCopyEnabled, setIsDriveCopyEnabled] = useState(() => localStorage.getItem(DRIVE_ENABLED_KEY) === 'true');
  // Profile is a route (/profile) so the Back button closes it and it can be linked to.
  const isProfileOpen = usePath() === '/profile';
  const setIsProfileOpen = useCallback((open: boolean) => {
    if (open) navigate('/profile');
    else closeOverlay('/profile');
  }, []);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Finish a redirect sign-in (PWA / popup-blocked path). onAuthStateChanged does the rest.
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        const token = result ? GoogleAuthProvider.credentialFromResult(result)?.accessToken : null;
        if (token && result?.providerId && sessionStorage.getItem('heirloom_drive_redirect')) {
          writeDriveToken(token);
          setGoogleAccessToken(token);
        }
      })
      .catch((err) => setAuthErrorMessage(describeAuthError(err)))
      .finally(() => sessionStorage.removeItem('heirloom_drive_redirect'));
  }, []);

  // Single place that turns a Firebase user into an app profile.
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      if (!fbUser) {
        setUser(null);
        setHousehold(null);
        setIsAuthLoading(false);
        return;
      }
      try {
        const profile = await firestoreService.ensureProfile(fbUser);
        setUser(profile);
        unsubscribeProfile = firestoreService.subscribeProfile(fbUser.uid, (p) => setUser(p));
      } catch (err) {
        console.error('Could not load your Heirloom profile:', err);
        setAuthErrorMessage('Signed in, but your cookbook could not be loaded. Check your connection and reload.');
      } finally {
        setIsAuthLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  // Keep the household (members + invite code) live.
  useEffect(() => {
    if (!user?.householdId) return;
    return firestoreService.subscribeHousehold(user.householdId, setHousehold, (err) =>
      console.warn('Household listener error:', err)
    );
  }, [user?.householdId]);

  // Drop the Drive token as soon as it expires.
  useEffect(() => {
    if (!googleAccessToken) return;
    const id = window.setInterval(() => {
      if (!readDriveToken()) setGoogleAccessToken(null);
    }, 60 * 1000);
    return () => window.clearInterval(id);
  }, [googleAccessToken]);

  const signInWithGoogle = async () => {
    setAuthErrorMessage(null);
    try {
      if (isStandalonePwa()) {
        await signInWithRedirect(auth, googleSignInProvider);
        return;
      }
      await signInWithPopup(auth, googleSignInProvider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleSignInProvider);
        return;
      }
      const message = describeAuthError(err);
      setAuthErrorMessage(message);
      throw new Error(message);
    }
  };

  const connectGoogleDrive = async (): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) throw new Error('Sign in before turning on the Google Drive copy.');
    try {
      if (isStandalonePwa()) {
        sessionStorage.setItem('heirloom_drive_redirect', 'true');
        localStorage.setItem(DRIVE_ENABLED_KEY, 'true');
        await signInWithRedirect(auth, googleDriveProvider);
        return null;
      }
      const hasGoogle = current.providerData.some((p) => p.providerId === 'google.com');
      const result = hasGoogle
        ? await reauthenticateWithPopup(current, googleDriveProvider)
        : await linkWithPopup(current, googleDriveProvider);
      const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken || null;
      if (!token) throw new Error('Google did not grant Drive access. Approve "See and edit files created by Heirloom" and try again.');
      writeDriveToken(token);
      setGoogleAccessToken(token);
      localStorage.setItem(DRIVE_ENABLED_KEY, 'true');
      setIsDriveCopyEnabled(true);
      return token;
    } catch (err: any) {
      throw new Error(describeAuthError(err));
    }
  };

  const disconnectGoogleDrive = () => {
    writeDriveToken(null);
    setGoogleAccessToken(null);
    localStorage.removeItem(DRIVE_ENABLED_KEY);
    setIsDriveCopyEnabled(false);
  };

  const markDriveTokenExpired = useCallback(() => {
    writeDriveToken(null);
    setGoogleAccessToken(null);
  }, []);

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) throw new Error('Sign in to save your preferences.');
    if (updates.preferredStore) localStorage.setItem('heirloom_preferred_store', updates.preferredStore);
    setUser({ ...user, ...updates });
    try {
      await firestoreService.updateProfile(user.id, updates);
    } catch (err) {
      setUser(user);
      throw new Error('Could not save your preferences. Check your connection and try again.');
    }
  };

  const joinHousehold = async (inviteCode: string) => {
    if (!user) throw new Error('Sign in before joining a household.');
    await firestoreService.joinHousehold(user, inviteCode);
  };

  const logout = async () => {
    await firebaseSignOut(auth).catch((err) => console.error('Sign out error:', err));
    disconnectGoogleDrive();
    setUser(null);
    setHousehold(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        household,
        isAuthLoading,
        isGoogleSignedIn: !!user,
        googleAccessToken,
        isGoogleConnected: !!googleAccessToken,
        isDriveCopyEnabled,
        signInWithGoogle,
        connectGoogleDrive,
        disconnectGoogleDrive,
        markDriveTokenExpired,
        updateProfile,
        joinHousehold,
        logout,
        authErrorMessage,
        clearAuthError: () => setAuthErrorMessage(null),
        isProfileOpen,
        setIsProfileOpen,
        isDriveModalOpen,
        setIsDriveModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
