import * as React from "react";

import { api } from "@/lib/api";

export interface CustomerUser {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  email_verified: boolean;
  marketing_opt_in: boolean;
}

export interface SignupInput {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  accept_terms: boolean;
  marketing_opt_in: boolean;
}

interface AuthContextValue {
  user: CustomerUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CustomerUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const u = await api.get<CustomerUser>("/auth/me");
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  React.useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await api.post<CustomerUser>("/auth/login", { email, password });
    setUser(result);
  }, []);

  const signup = React.useCallback(async (input: SignupInput) => {
    const result = await api.post<CustomerUser>("/auth/signup", input);
    setUser(result);
  }, []);

  const logout = React.useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const resendVerification = React.useCallback(async () => {
    await api.post("/auth/resend-verification");
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, login, signup, logout, refresh, resendVerification }),
    [user, loading, login, signup, logout, refresh, resendVerification],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
