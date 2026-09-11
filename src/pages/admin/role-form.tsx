import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

interface FieldErrors {
  name?: string;
}

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
};

const MODULE_LABELS: Record<string, string> = {
  products: "Products",
  categories: "Categories",
  users: "Users",
  roles: "Roles",
};

export function AdminRoleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [permissionCatalogue, setPermissionCatalogue] = useState<Record<string, string[]>>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isSystem, setIsSystem] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    api.get<Record<string, string[]>>("/admin/permissions").then(setPermissionCatalogue);
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    api.get<Role>(`/admin/roles/${id}`).then((r) => {
      setName(r.name);
      setDescription(r.description ?? "");
      setPermissions(new Set(r.permissions));
      setIsSystem(r.is_system);
      setLoaded(true);
    });
  }, [isEdit, id]);

  const togglePermission = (key: string) => {
    if (isSystem) return;
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleModule = (module: string, actions: string[]) => {
    if (isSystem) return;
    const moduleKeys = actions.map((a) => `${module}.${a}`);
    const allSelected = moduleKeys.every((k) => permissions.has(k));
    setPermissions((prev) => {
      const next = new Set(prev);
      moduleKeys.forEach((k) => {
        if (allSelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
  };

  const toggleAction = (action: string) => {
    if (isSystem) return;
    const modules = Object.keys(permissionCatalogue);
    const actionKeys = modules.map((m) => `${m}.${action}`);
    const allSelected = actionKeys.every((k) => permissions.has(k));
    setPermissions((prev) => {
      const next = new Set(prev);
      actionKeys.forEach((k) => {
        if (allSelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = "Name is required";
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSystem) return;
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        permissions: Array.from(permissions),
      };
      if (isEdit && id) {
        await api.put(`/admin/roles/${id}`, payload);
      } else {
        await api.post("/admin/roles", payload);
      }
      toast.success(isEdit ? "Role updated" : "Role created");
      navigate("/admin/roles");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded || Object.keys(permissionCatalogue).length === 0) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">Loading...</p>
      </AdminLayout>
    );
  }

  const modules = Object.keys(permissionCatalogue);
  const actions = Object.values(permissionCatalogue)[0] ?? [];

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold">
        {isEdit ? (isSystem ? "View Role" : "Edit Role") : "Add Role"}
      </h1>

      {isSystem && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[hsl(var(--admin-accent))] bg-[hsl(var(--admin-accent-light))] p-4 text-sm text-[hsl(var(--admin-accent))]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">System role</p>
            <p className="mt-0.5 text-[hsl(var(--admin-accent))]/80">
              This role is built into the system and always has every permission. It can't be
              renamed, edited, or deleted — this guarantees at least one account can always manage
              the system.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-4 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
      >
        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSystem}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1 disabled:bg-zinc-50 disabled:text-muted-foreground",
              fieldErrors.name
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSystem}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))] disabled:bg-zinc-50 disabled:text-muted-foreground"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Permissions</p>
          <div className="overflow-hidden rounded-2xl border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Module</th>
                  {actions.map((action) => (
                    <th key={action} className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAction(action)}
                        disabled={isSystem}
                        className="cursor-pointer text-xs uppercase hover:text-foreground disabled:cursor-default"
                        title={isSystem ? undefined : `Toggle "${ACTION_LABELS[action] ?? action}" for all modules`}
                      >
                        {ACTION_LABELS[action] ?? action}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          toggleModule(module, permissionCatalogue[module] ?? [])
                        }
                        disabled={isSystem}
                        className="font-medium hover:text-[hsl(var(--admin-accent))] disabled:cursor-default disabled:hover:text-foreground"
                        title={isSystem ? undefined : "Toggle all permissions in this module"}
                      >
                        {MODULE_LABELS[module] ?? module}
                      </button>
                    </td>
                    {(permissionCatalogue[module] ?? []).map((action) => {
                      const key = `${module}.${action}`;
                      const checked = isSystem ? true : permissions.has(key);
                      return (
                        <td key={action} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePermission(key)}
                            disabled={isSystem}
                            className="h-4 w-4 cursor-pointer accent-[hsl(var(--admin-accent))] disabled:cursor-default"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: click a column header to toggle that action across every module, or a module name
            to toggle all four actions for that module.
          </p>
        </div>

        {!isSystem && (
          <Button type="submit" variant="accent" size="lg" disabled={submitting} className="mt-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : "Save Role"}
          </Button>
        )}
      </form>
    </AdminLayout>
  );
}
