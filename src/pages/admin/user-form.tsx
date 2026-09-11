import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Role {
  id: number;
  name: string;
  is_system: boolean;
}

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role_id: number | null;
}

interface FieldErrors {
  email?: string;
  full_name?: string;
  password?: string;
  role_id?: string;
}

export function AdminUserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [roles, setRoles] = useState<Role[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    api
      .get<{ items: Role[] }>("/admin/roles?page_size=100")
      .then((res) => {
        setRoles(res.items);
        if (!isEdit && res.items.length > 0) setRoleId(String(res.items[0].id));
      });
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit || !id) return;
    api.get<AdminUser>(`/admin/users/${id}`).then((u) => {
      setEmail(u.email);
      setFullName(u.full_name);
      setRoleId(u.role_id ? String(u.role_id) : "");
      setLoaded(true);
    });
  }, [isEdit, id]);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = "Email is required";
    else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address";
    if (!fullName.trim()) errors.full_name = "Full name is required";
    if (!isEdit && password.length < 8) errors.password = "At least 8 characters";
    if (isEdit && password && password.length < 8)
      errors.password = "At least 8 characters (or leave blank)";
    if (!roleId) errors.role_id = "Select a role";
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      if (isEdit && id) {
        await api.put(`/admin/users/${id}`, {
          email,
          full_name: fullName,
          password: password || null,
          role_id: Number(roleId),
        });
      } else {
        await api.post("/admin/users", {
          email,
          full_name: fullName,
          password,
          role_id: Number(roleId),
        });
      }
      toast.success(isEdit ? "User updated" : "User created");
      navigate("/admin/users");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">Loading...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold">{isEdit ? "Edit User" : "Add User"}</h1>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-4 flex max-w-xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
      >
        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className="text-sm font-medium">
            Full Name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.full_name
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          {fieldErrors.full_name && (
            <p className="text-xs text-destructive">{fieldErrors.full_name}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.email
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            {isEdit ? "New password (leave blank to keep current)" : "Password"}
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              "w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.password
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          <p
            className={cn(
              "text-xs",
              fieldErrors.password ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {fieldErrors.password ?? "At least 8 characters"}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium">
            Role
          </label>
          <select
            id="role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.role_id
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          >
            <option value="" disabled>
              Select a role
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
                {role.is_system ? " (system)" : ""}
              </option>
            ))}
          </select>
          {fieldErrors.role_id && (
            <p className="text-xs text-destructive">{fieldErrors.role_id}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={submitting}
          className="mt-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Saving..." : "Save User"}
        </Button>
      </form>
    </AdminLayout>
  );
}
