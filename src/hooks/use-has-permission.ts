import { useAdminAuth } from "@/context/admin-auth-context";

/**
 * Returns true if the currently-logged-in admin has the given permission key.
 * Super Admin (is_system_role=true) always returns true.
 * Returns false if no admin is logged in.
 */
export function useHasPermission(key: string): boolean {
  const { admin } = useAdminAuth();
  if (!admin) return false;
  if (admin.is_system_role) return true;
  return admin.permissions.includes(key);
}

/**
 * Returns true if the admin has *any* of the given permission keys.
 * Useful for hiding a whole nav group when the admin has none of its items.
 */
export function useHasAnyPermission(keys: string[]): boolean {
  const { admin } = useAdminAuth();
  if (!admin) return false;
  if (admin.is_system_role) return true;
  return keys.some((k) => admin.permissions.includes(k));
}
