import * as React from "react";

import { api } from "@/lib/api";

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role_id: number | null;
  role_name: string | null;
  is_system_role: boolean;
  permissions: string[];
}

interface AdminAuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = React.createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = React.useState<AdminUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .get<AdminUser>("/admin/auth/me")
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await api.post<AdminUser>("/admin/auth/login", { email, password });
    setAdmin(result);
  }, []);

  const logout = React.useCallback(async () => {
    await api.post("/admin/auth/logout");
    setAdmin(null);
  }, []);

  const value = React.useMemo(
    () => ({ admin, loading, login, logout }),
    [admin, loading, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = React.useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return ctx;
}
