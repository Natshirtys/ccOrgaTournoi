import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getStoredToken, storeToken, removeToken, apiMe, type AuthUser } from '@/api/auth';

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);

  // Au montage, vérifier que le token stocké est encore valide
  useEffect(() => {
    if (!token) return;
    apiMe()
      .then(setUser)
      .catch(() => {
        removeToken();
        setToken(null);
        setUser(null);
      });
  }, []);

  const login = useCallback(async (newToken: string) => {
    storeToken(newToken);
    setToken(newToken);
    const me = await apiMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
