import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getAuthToken, setAuthToken, clearAuthToken, type AuthUser } from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api.getMe()
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthToken();
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.signIn(email, password);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const res = await api.signUp(email, password, name);
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(() => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, token, loading, signIn, signUp, signOut }), [user, token, loading, signIn, signUp, signOut]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
