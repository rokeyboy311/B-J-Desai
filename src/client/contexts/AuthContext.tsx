import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { 
  apiFetch, 
  getStoredPinToken, 
  setStoredPinToken, 
  clearStoredPinToken,
  clearStoredCategoryPinToken
} from "../lib/api";

export interface SystemUser {
  id: number;
  email: string;
  name: string;
}

export interface AuthContextType {
  isUnlocked: boolean;
  loading: boolean;
  error: string | null;
  user: SystemUser | null;
  dbUser: SystemUser | null;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  // Compatibility helpers
  login?: (email: string, pass: string) => Promise<any>;
  registerUser?: (email: string, pass: string) => Promise<any>;
  signInWithGoogle?: () => Promise<any>;
  resetPassword?: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);

  const lockApp = useCallback(() => {
    clearStoredPinToken();
    clearStoredCategoryPinToken();
    setIsUnlocked(false);
    setSystemUser(null);
    setError(null);
  }, []);

  const verifyCurrentSession = useCallback(async () => {
    const token = getStoredPinToken();
    if (!token) {
      setIsUnlocked(false);
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/auth/verify-session', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      if (res.valid) {
        setIsUnlocked(true);
        setSystemUser(res.user || { id: 1, email: 'admin@bj.com', name: 'B J Admin' });
      } else {
        clearStoredPinToken();
        setIsUnlocked(false);
      }
    } catch (err) {
      console.warn('Session verification check failed:', err);
      // If server unreachable or error, keep lock screen
      clearStoredPinToken();
      setIsUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyCurrentSession();

    const handleUnauthorized = () => {
      lockApp();
    };

    window.addEventListener('bd_erp_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('bd_erp_unauthorized', handleUnauthorized);
    };
  }, [verifyCurrentSession, lockApp]);

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiFetch('/auth/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: pin.trim() })
      });

      if (res.success && res.token) {
        setStoredPinToken(res.token);
        setIsUnlocked(true);
        setSystemUser(res.user || { id: 1, email: 'admin@bj.com', name: 'B J Admin' });
        setError(null);
        return true;
      } else {
        setError(res.error || 'Invalid Access PIN');
        return false;
      }
    } catch (err: any) {
      console.error('PIN verification error:', err);
      setError(err.message || 'Incorrect PIN. Access Denied.');
      return false;
    }
  };

  const logout = async () => {
    lockApp();
  };

  return (
    <AuthContext.Provider
      value={{
        isUnlocked,
        loading,
        error,
        user: systemUser,
        dbUser: systemUser,
        unlockWithPin,
        lockApp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const usePinAccess = useAuth;
