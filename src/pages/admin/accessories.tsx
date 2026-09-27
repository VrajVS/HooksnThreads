import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, Pencil, Plus, PlusCircle, Search, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";
import { type Accessory, formatQty, isLowStock, toNumber } from "@/lib/inventory";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export function AdminAccessoriesPage() {
  const canCreate = useHasPermission("accessories.create");
  const canUpdate = useHasPermission("accessories.update");
  const canDelete = useHasPermission("accessories.delete");
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [total, setTotal] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Accessory | null>(null);
  const [adjusting, setAdjusting] = useState<Accessory | null>(null);

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
    if (lowOnly) query.set("low_stock", "true");
    api
      .get<{ items: Accessory[]; total: number; low_stock_count: number }>(`/admin/accessories?${query}`)
      .then((res) => {
        setAccessories(res.items);
        setTotal(res.total);
        setLowStockCount(res.low_stock_count);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load accessories"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, search, lowOnly]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.delete(`/admin/accessories/${pendingDelete.id}`);
      toast.success(`"${pendingDelete.name}" deleted`);
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete accessory");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Accessories</h1>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setPage(1);
                setLowOnly((v) => !v);
              }}
              aria-pressed={lowOnly}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                lowOnly
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              Low stock
              <span className="rounded-full bg-white/70 px-1.5 text-xs tabular-nums">{lowStockCount}</span>
            </button>
            <div className="flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search accessories..."
                className="ml-2 w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
            {canCreate && (
              <Button asChild variant="accent">
                <Link to="/admin/accessories/new">
                  <Plus className="h-4 w-4" />
                  Add Accessory
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
                  <th className="px-4 py-3 text-right">In stock</th>
                  <th className="px-4 py-3 text-right">Alert at</th>
                  <th className="px-4 py-3">Used in</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
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
                ) : accessories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {search || lowOnly
                        ? "No accessories matched."
                        : "No accessories yet. Add the materials you use, like yarn, keyrings and clips."}
                    </td>
                  </tr>
                ) : (
                  accessories.map((accessory) => {
                    const low = isLowStock(accessory);
                    return (
                      <tr key={accessory.id} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/admin/accessories/${accessory.id}/edit`} className="hover:underline">
                            {accessory.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1",
                              toNumber(accessory.stock) < 0
                                ? "bg-destructive/10 font-medium text-destructive"
                                : low && "bg-amber-100 font-medium text-amber-900",
                            )}
                          >
                            {formatQty(accessory.stock)} {accessory.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatQty(accessory.low_stock_threshold)} {accessory.unit}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {accessory.product_count
                            ? `${accessory.product_count} product${accessory.product_count === 1 ? "" : "s"}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {canUpdate && (
                              <button
                                onClick={() => setAdjusting(accessory)}
                                title="Adjust stock"
                                aria-label={`Adjust stock of ${accessory.name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100"
                              >
                                <PlusCircle className="h-4 w-4" />
                              </button>
                            )}
                            {canUpdate && (
                              <Link
                                to={`/admin/accessories/${accessory.id}/edit`}
                                aria-label={`Edit ${accessory.name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setPendingDelete(accessory)}
                                aria-label={`Delete ${accessory.name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && !error && (
            <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      </div>

      <AdjustStockDialog
        accessory={adjusting}
        onClose={() => setAdjusting(null)}
        onSaved={() => {
          setAdjusting(null);
          load();
        }}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete accessory?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{pendingDelete?.name}" and its stock history.
              Accessories mapped to products can't be deleted.
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

export function AdjustStockDialog({
  accessory,
  onClose,
  onSaved,
}: {
  accessory: { id: number; name: string; unit: string; stock: number | string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accessory) {
      setMode("add");
      setAmount("");
      setNote("");
      setError(null);
    }
  }, [accessory]);

  const value = Number(amount);
  const valid = amount !== "" && !Number.isNaN(value) && value > 0;
  const after = accessory ? toNumber(accessory.stock) + (mode === "add" ? value : -value) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessory || !valid) {
      setError("Enter a quantity greater than 0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/accessories/${accessory.id}/adjust`, {
        change: mode === "add" ? value : -value,
        note: note.trim() || null,
      });
      toast.success(`Stock updated for "${accessory.name}"`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={accessory !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock: {accessory?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-2 rounded-full bg-zinc-100 p-1">
            {(["add", "remove"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-full py-2 text-sm font-medium transition-colors",
                  mode === m ? "bg-white shadow-sm" : "text-zinc-500",
                )}
              >
                {m === "add" ? "Add stock" : "Remove stock"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adjust-amount" className="text-sm font-medium">
              Quantity ({accessory?.unit})
            </label>
            <input
              id="adjust-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
            />
            {accessory && (
              <p className="text-xs text-muted-foreground">
                Current: {formatQty(accessory.stock)} {accessory.unit}
                {valid && (
                  <>
                    {" "}→ after: <span className={cn("font-medium", after < 0 && "text-destructive")}>{formatQty(after)} {accessory.unit}</span>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adjust-note" className="text-sm font-medium">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="adjust-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "add" ? "e.g. Bought from Meesho" : "e.g. Damaged"}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
            />
          </div>
          <Button type="submit" variant="accent" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
