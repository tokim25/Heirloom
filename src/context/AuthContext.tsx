import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/recipe.ts';
import { auth, googleSignInProvider, googleDriveProvider } from '../utils/firebase.ts';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mise_auth_token'));
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setIsGoogleSignedIn(true);
        // Automatically sync or create profile with real Google account data
        setUser((prev) => ({
          id: fbUser.uid,
          email: fbUser.email || prev?.email || 'Tokim25@gmail.com',
          name: fbUser.displayName || prev?.name || 'Tokim',
          avatarUrl: fbUser.photoURL || prev?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          preferredStore: prev?.preferredStore || 'Whole Foods Market',
          dietaryPreferences: prev?.dietaryPreferences || ['High-Protein', 'Fresh Herbs'],
          partnerEmail: prev?.partnerEmail || 'alex@family.kitchen',
          householdId: prev?.householdId || 'household-tokim-kitchen',
          createdAt: prev?.createdAt || new Date().toISOString(),
        }));
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
      const result = await signInWithPopup(auth, googleDriveProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || null;
      if (accessToken) {
        setGoogleAccessToken(accessToken);
      }
      if (result.user) {
        setIsGoogleSignedIn(true);
        setUser((prev) => ({
          id: result.user.uid,
          email: result.user.email || prev?.email || 'Tokim25@gmail.com',
          name: result.user.displayName || prev?.name || 'Tokim',
          avatarUrl: result.user.photoURL || prev?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          preferredStore: prev?.preferredStore || 'Whole Foods Market',
          dietaryPreferences: prev?.dietaryPreferences || ['High-Protein', 'Fresh Herbs'],
          partnerEmail: prev?.partnerEmail || 'alex@family.kitchen',
          householdId: prev?.householdId || 'household-tokim-kitchen',
          createdAt: prev?.createdAt || new Date().toISOString(),
        }));
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
      const result = await signInWithPopup(auth, googleSignInProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || null;
      // Standard Google sign-in returns only identity scopes. Do not treat that
      // token as Drive authorization; Drive requires the incremental provider.
      if (result.user) {
        setIsGoogleSignedIn(true);
        setUser((prev) => ({
          id: result.user.uid,
          email: result.user.email || prev?.email || 'Tokim25@gmail.com',
          name: result.user.displayName || prev?.name || 'Tokim',
          avatarUrl: result.user.photoURL || prev?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
          preferredStore: prev?.preferredStore || 'Whole Foods Market',
          dietaryPreferences: prev?.dietaryPreferences || ['High-Protein', 'Fresh Herbs'],
          partnerEmail: prev?.partnerEmail || 'alex@family.kitchen',
          householdId: prev?.householdId || 'household-tokim-kitchen',
          createdAt: prev?.createdAt || new Date().toISOString(),
        }));
      }
      return accessToken;
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      throw err;
    }
  };

  const disconnectGoogleDrive = async () => {
    setGoogleAccessToken(null);
  };

  // Fetch current user or default user on mount
  useEffect(() => {
    async function loadUser() {
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
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: user.id, ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsProfileOpen(false);
      }
    } catch (err) {
      console.error('Update profile error:', err);
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
