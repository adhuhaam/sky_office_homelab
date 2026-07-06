import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, ApiError, registerAuthRecoveryHandler, type AuthUser } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  networkError: boolean;
  refreshing: boolean;
  refresh: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    try {
      const me = await apiFetch<AuthUser>("/auth/me");
      const authed = me.authenticated;
      setUser(authed ? me : null);
      setNetworkError(false);
      return authed;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setUser(null);
          setNetworkError(false);
        } else if (err.status >= 500) {
          setNetworkError(true);
        } else {
          setUser(null);
          setNetworkError(false);
        }
      } else {
        setNetworkError(true);
      }
      return false;
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    registerAuthRecoveryHandler(refresh);
    return () => registerAuthRecoveryHandler(null);
  }, [refresh]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ user, loading, networkError, refreshing, refresh, login, logout, register }),
    [user, loading, networkError, refreshing, refresh, login, logout, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useHasRole(...roles: string[]) {
  const { user } = useAuth();
  return user?.role ? roles.includes(user.role) : false;
}
