import * as React from "react";

import { api } from "@/lib/api";

export interface CustomerUser {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
}

interface AuthContextValue {
  user: CustomerUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CustomerUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .get<CustomerUser>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await api.post<CustomerUser>("/auth/login", { email, password });
    setUser(result);
  }, []);

  const signup = React.useCallback(
    async (email: string, password: string, full_name: string, phone?: string) => {
      const result = await api.post<CustomerUser>("/auth/signup", {
        email,
        password,
        full_name,
        phone,
      });
      setUser(result);
    },
    [],
  );

  const logout = React.useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
