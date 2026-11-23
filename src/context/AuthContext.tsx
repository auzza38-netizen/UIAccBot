import React, { createContext, useContext, useState } from 'react';
import { AppUser } from '../types';
import { MOCK_MASTER_ADMIN } from '../data/mockData';
import { isMasterAdminEmail } from '../services/dbService';

export interface AuthErrorInfo {
  code: string;
  title: string;
  detail: string;
  solution: string;
  actionType?: 'copy_domain' | 'redirect_signin' | 'allow_popup' | 'check_network';
}

interface AuthContextType {
  currentUser: AppUser | null;
  isAdmin: boolean;
  isApproved: boolean;
  loading: boolean;
  isSigningIn: boolean;
  authError: AuthErrorInfo | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleRedirect: () => Promise<void>;
  signInAsMasterAdmin: () => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: MOCK_MASTER_ADMIN,
  isAdmin: true,
  isApproved: true,
  loading: false,
  isSigningIn: false,
  authError: null,
  signInWithGoogle: async () => {},
  signInWithGoogleRedirect: async () => {},
  signInAsMasterAdmin: () => {},
  signOut: async () => {},
  refreshUser: async () => {},
  clearAuthError: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(MOCK_MASTER_ADMIN);
  const [loading] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setCurrentUser({
      ...MOCK_MASTER_ADMIN,
      lastLoginAt: new Date().toISOString(),
    });
    setIsSigningIn(false);
  };

  const signInWithGoogleRedirect = async () => {
    await signInWithGoogle();
  };

  const signInAsMasterAdmin = () => {
    signInWithGoogle().catch(() => {});
  };

  const signOut = async () => {
    setCurrentUser(null);
    setAuthError(null);
  };

  const refreshUser = async () => {
    // No-op in Frontend UI Template mode
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const isMaster = Boolean(
    isMasterAdminEmail(currentUser?.email) || currentUser?.role === 'admin'
  );

  const isApproved = isMaster || currentUser?.status === 'active';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin: isMaster,
        isApproved,
        loading,
        isSigningIn,
        authError,
        signInWithGoogle,
        signInWithGoogleRedirect,
        signInAsMasterAdmin,
        signOut,
        refreshUser,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
