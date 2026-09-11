import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminLayout } from "@/components/admin-layout";
import { AdminPagination } from "@/components/admin-pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";

const PAGE_SIZE = 25;

interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_count: number;
  user_count: number;
  created_at: string;
}

export function AdminRolesPage() {
  const canCreate = useHasPermission("roles.create");
  const canUpdate = useHasPermission("roles.update");
  const canDelete = useHasPermission("roles.delete");

  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const load = () => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (search) query.set("search", search);
    api
      .get<{ items: Role[]; total: number }>(`/admin/roles?${query}`)
      .then((res) => {
        setRoles(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load roles"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, search]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.delete(`/admin/roles/${pendingDelete.id}`);
      toast.success(`"${pendingDelete.name}" deleted`);
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete role");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Roles</h1>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search roles..."
                className="ml-2 w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
            {canCreate && (
              <Button asChild variant="accent">
                <Link to="/admin/roles/new">
                  <Plus className="h-4 w-4" />
                  Add Role
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-12" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-12" />
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <p className="text-destructive">{error}</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={load}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {search ? "No roles matched your search." : "No roles yet."}
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium">
                          {role.name}
                          {role.is_system && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--admin-accent-light))] px-2 py-0.5 text-[10px] font-semibold uppercase text-[hsl(var(--admin-accent))]">
                              <ShieldCheck className="h-3 w-3" />
                              System
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {role.description ?? "—"}
                      </td>
                      <td className="px-4 py-3">{role.permission_count}</td>
                      <td className="px-4 py-3">{role.user_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {(canUpdate || role.is_system) && (
                            <Link
                              to={`/admin/roles/${role.id}/edit`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100"
                              title={role.is_system ? "View (read-only)" : "Edit"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {canDelete && !role.is_system && (
                            <button
                              onClick={() => setPendingDelete(role)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && !error && (
            <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{pendingDelete?.name}". Roles with users assigned to
              them can't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
