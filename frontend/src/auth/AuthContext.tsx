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

  const clearAuth = useCallback(() => {
    removeToken();
    setToken(null);
    setUser(null);
  }, []);

  // Au montage, vérifier que le token stocké est encore valide
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    apiMe(controller.signal)
      .then(setUser)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        clearAuth();
      });
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Écouter les 401 remontés par apiFetch — source unique de vérité pour le cleanup
  useEffect(() => {
    window.addEventListener('auth:expired', clearAuth);
    return () => window.removeEventListener('auth:expired', clearAuth);
  }, [clearAuth]);

  const login = useCallback(async (newToken: string) => {
    storeToken(newToken);
    setToken(newToken);
    try {
      const me = await apiMe();
      setUser(me);
    } catch {
      // Le token est valide (login réussi), /me a échoué de façon transitoire.
      // On garde le token ; l'effet de montage retentera au prochain rendu.
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

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
