import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/recipe.ts';
import { auth, googleSignInProvider, googleDriveProvider } from '../utils/firebase.ts';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  googleAccessToken: string | null;
  isGoogleSignedIn: boolean;
  isGoogleConnected: boolean;
  login: (email: string) => Promise<void>;
  signup: (userData: Partial<User>) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  connectGoogleDrive: () => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  disconnectGoogleDrive: () => Promise<void>;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isDriveModalOpen: boolean;
  setIsDriveModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readLocalPreferredStore = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('heirloom_preferred_store');
};

const readSessionDriveToken = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('heirloom_google_drive_token');
};

const writeSessionDriveToken = (accessToken: string | null) => {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    sessionStorage.setItem('heirloom_google_drive_token', accessToken);
  } else {
    sessionStorage.removeItem('heirloom_google_drive_token');
  }
};

const shouldUseRedirectSignIn = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent;
  return (
    window.navigator.maxTouchPoints > 1 ||
    /Android|iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS/i.test(userAgent)
  );
};

const markProfileReturn = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('heirloom_return_to_profile', 'true');
};

const consumeProfileReturn = () => {
  if (typeof window === 'undefined') return false;
  const shouldReturn = sessionStorage.getItem('heirloom_return_to_profile') === 'true';
  sessionStorage.removeItem('heirloom_return_to_profile');
  return shouldReturn;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mise_auth_token'));
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => readSessionDriveToken());
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  const profileFromFirebaseUser = (
    fbUser: NonNullable<typeof auth.currentUser>,
    previousUser: User | null
  ): User => {
    const email = fbUser.email || previousUser?.email || '';
    const name = fbUser.displayName || previousUser?.name || email.split('@')[0] || 'Heirloom User';

    return {
      id: fbUser.uid,
      email,
      name,
      avatarUrl: fbUser.photoURL || previousUser?.avatarUrl,
      preferredStore: readLocalPreferredStore() || previousUser?.preferredStore || 'Whole Foods Market',
      dietaryPreferences: previousUser?.dietaryPreferences || [],
      partnerEmail: previousUser?.partnerEmail || '',
      householdId: previousUser?.householdId || `household-${fbUser.uid}`,
      createdAt: previousUser?.createdAt || new Date().toISOString(),
    };
  };

  const syncFirebaseUserToAppProfile = async (
    fbUser: NonNullable<typeof auth.currentUser>,
    previousUser: User | null
  ) => {
    const provisionalUser = profileFromFirebaseUser(fbUser, previousUser);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provisionalUser),
    });
    if (!res.ok) {
      throw new Error('Failed to create your Heirloom profile. Please try signing in again.');
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('mise_auth_token', data.token);
    return data.user as User;
  };

  useEffect(() => {
    async function finishRedirectSignIn() {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) return;
        setIsGoogleSignedIn(true);
        const syncedUser = await syncFirebaseUserToAppProfile(result.user, user);
        setUser(syncedUser);
        if (consumeProfileReturn()) {
          setIsProfileOpen(true);
        }
      } catch (err) {
        console.error('Google redirect sign-in error:', err);
        consumeProfileReturn();
      }
    }
    finishRedirectSignIn();
  }, []);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setIsGoogleSignedIn(true);
        let previousUser: User | null = null;
        setUser((prev) => {
          previousUser = prev;
          return profileFromFirebaseUser(fbUser, prev);
        });
        try {
          await syncFirebaseUserToAppProfile(fbUser, previousUser);
        } catch (err) {
          console.error('Failed to sync Firebase user profile:', err);
        }
      } else {
        setIsGoogleSignedIn(false);
        setGoogleAccessToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Connect Google Drive using Popup flow & grab access token (incremental drive scope)
  const connectGoogleDrive = async (): Promise<string | null> => {
    try {
      const result = auth.currentUser
        ? await reauthenticateWithPopup(auth.currentUser, googleDriveProvider)
        : await signInWithPopup(auth, googleDriveProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || null;
      if (accessToken) {
        setGoogleAccessToken(accessToken);
        writeSessionDriveToken(accessToken);
      } else {
        throw new Error('Google did not return Drive file access. Please approve Google Drive access and try again.');
      }
      if (result.user) {
        setIsGoogleSignedIn(true);
        const syncedUser = await syncFirebaseUserToAppProfile(result.user, user);
        setUser(syncedUser);
      }
      return accessToken;
    } catch (err: any) {
      console.error('Google Drive connection error:', err);
      throw err;
    }
  };

  // Standard Google Sign-In (profile & email ONLY, no scary unverified app warnings)
  const signInWithGoogle = async (): Promise<string | null> => {
    try {
      if (shouldUseRedirectSignIn()) {
        markProfileReturn();
        await signInWithRedirect(auth, googleSignInProvider);
        return null;
      }
      const result = await signInWithPopup(auth, googleSignInProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || null;
      // Standard Google sign-in returns only identity scopes. Do not treat that
      // token as Drive authorization; Drive requires the incremental provider.
      if (result.user) {
        setIsGoogleSignedIn(true);
        const syncedUser = await syncFirebaseUserToAppProfile(result.user, user);
        setUser(syncedUser);
      }
      return accessToken;
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        markProfileReturn();
        await signInWithRedirect(auth, googleSignInProvider);
        return null;
      }
      console.error('Google Sign-in error:', err);
      throw err;
    }
  };

  const disconnectGoogleDrive = async () => {
    setGoogleAccessToken(null);
    writeSessionDriveToken(null);
  };

  // Fetch current token-backed user on mount
  useEffect(() => {
    async function loadUser() {
      if (!token) return;
      try {
        const res = await fetch('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('mise_auth_token', data.token);
        setIsAuthModalOpen(false);
      }
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const signup = async (userData: Partial<User>) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('mise_auth_token', data.token);
        setIsAuthModalOpen(false);
      }
    } catch (err) {
      console.error('Signup error:', err);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const previousUser = user;
    const optimisticUser = { ...user, ...updates };
    setUser(optimisticUser);
    if (updates.preferredStore && typeof window !== 'undefined') {
      localStorage.setItem('heirloom_preferred_store', updates.preferredStore);
    }
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...user, ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser({ ...data.user, ...updates });
      } else {
        const data = await res.json().catch(() => ({}));
        setUser(previousUser);
        throw new Error(data.error || 'Failed to save profile changes.');
      }
    } catch (err) {
      console.error('Update profile error:', err);
      setUser(previousUser);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setUser(null);
    setToken(null);
    setGoogleAccessToken(null);
    writeSessionDriveToken(null);
    setIsGoogleSignedIn(false);
    localStorage.removeItem('mise_auth_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        googleAccessToken,
        isGoogleSignedIn,
        isGoogleConnected: !!googleAccessToken,
        login,
        signup,
        updateProfile,
        logout,
        connectGoogleDrive,
        signInWithGoogle,
        disconnectGoogleDrive,
        isProfileOpen,
        setIsProfileOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
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
