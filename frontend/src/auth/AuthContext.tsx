import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, tokens, type AuthUser, type RegistroPayload } from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  registrar: (payload: RegistroPayload) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermiso: (codigo: string) => boolean;
  hasRole: (...roles: AuthUser['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      if (!tokens.access) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (activo) setUser(me);
      } catch {
        tokens.clear();
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const registrar = useCallback(async (payload: RegistroPayload) => {
    const result = await authApi.registrar(payload);
    tokens.set(result.accessToken, result.refreshToken);
    setUser(result.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    tokens.set(result.accessToken, result.refreshToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokens.refresh;
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        tokens.clear();
      }
    }
    tokens.clear();
    setUser(null);
  }, []);

  const hasPermiso = useCallback(
    (codigo: string) => Boolean(user?.permisos?.includes(codigo) || user?.role === 'ADMINISTRADOR'),
    [user],
  );

  const hasRole = useCallback((...roles: AuthUser['role'][]) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, registrar, login, logout, hasPermiso, hasRole }),
    [user, loading, registrar, login, logout, hasPermiso, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
