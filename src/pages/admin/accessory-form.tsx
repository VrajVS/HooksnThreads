import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";
import { type Accessory, type Qty, formatDateTime, formatQty, toNumber } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { AdjustStockDialog } from "@/pages/admin/accessories";

const UNIT_SUGGESTIONS = ["pcs", "g", "m", "skein", "pair", "set", "cm"];

const REASON_LABELS: Record<string, string> = {
  initial: "Opening stock",
  adjustment: "Manual adjustment",
  order: "Used by order",
  order_cancelled: "Order cancelled",
};

interface AccessoryDetail extends Accessory {
  products: { handle: string; title: string; image: string; quantity: Qty }[];
  movements: {
    id: number;
    change: Qty;
    reason: string;
    order_id: number | null;
    note: string | null;
    created_at: string;
    admin_name: string | null;
  }[];
}

interface FieldErrors {
  name?: string;
  unit?: string;
  stock?: string;
  threshold?: string;
}

const inputClass = (invalid?: string) =>
  cn(
    "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
    invalid
      ? "border-destructive focus:ring-destructive"
      : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
  );

export function AdminAccessoryFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const canUpdate = useHasPermission("accessories.update");

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");
  const [detail, setDetail] = useState<AccessoryDetail | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loaded, setLoaded] = useState(!isEdit);

  const loadDetail = useCallback(() => {
    if (!id) return;
    api
      .get<AccessoryDetail>(`/admin/accessories/${id}`)
      .then((a) => {
        setDetail(a);
        setName(a.name);
        setUnit(a.unit);
        setThreshold(formatQty(a.low_stock_threshold));
        setLoaded(true);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load accessory");
        setLoaded(true);
      });
  }, [id]);

  useEffect(loadDetail, [loadDetail]);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = "Name is required";
    if (!unit.trim()) errors.unit = "Unit is required";
    if (!isEdit && stock !== "" && (Number.isNaN(Number(stock)) || Number(stock) < 0))
      errors.stock = "Enter 0 or more";
    if (threshold !== "" && (Number.isNaN(Number(threshold)) || Number(threshold) < 0))
      errors.threshold = "Enter 0 or more";
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const body = {
      name: name.trim(),
      unit: unit.trim(),
      low_stock_threshold: Number(threshold || 0),
    };
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/admin/accessories/${id}`, body);
      } else {
        await api.post("/admin/accessories", { ...body, stock: Number(stock || 0) });
      }
      toast.success(isEdit ? "Accessory updated" : "Accessory created");
      navigate("/admin/accessories");
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
      <h1 className="text-2xl font-semibold">{isEdit ? "Edit Accessory" : "Add Accessory"}</h1>

      <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex w-full max-w-xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
        >
          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Red cotton yarn, Keyring, Snap clip"
              className={inputClass(fieldErrors.name)}
            />
            {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="unit" className="text-sm font-medium">Unit</label>
            <input
              id="unit"
              list="unit-suggestions"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={inputClass(fieldErrors.unit)}
            />
            <datalist id="unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">
              How you count it: pcs for keyrings, g or m for yarn.
            </p>
            {fieldErrors.unit && <p className="text-xs text-destructive">{fieldErrors.unit}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isEdit && detail ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">In stock</span>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2">
                  <span className={cn("tabular-nums", toNumber(detail.stock) < 0 && "font-medium text-destructive")}>
                    {formatQty(detail.stock)} {detail.unit}
                  </span>
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => setAdjustOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--admin-accent))] hover:underline"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Adjust
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="stock" className="text-sm font-medium">Opening stock</label>
                <input
                  id="stock"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className={inputClass(fieldErrors.stock)}
                />
                {fieldErrors.stock && <p className="text-xs text-destructive">{fieldErrors.stock}</p>}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="threshold" className="text-sm font-medium">Low-stock alert at</label>
              <input
                id="threshold"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="0"
                className={inputClass(fieldErrors.threshold)}
              />
              {fieldErrors.threshold && (
                <p className="text-xs text-destructive">{fieldErrors.threshold}</p>
              )}
            </div>
          </div>

          <Button type="submit" variant="accent" size="lg" disabled={submitting} className="mt-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : "Save Accessory"}
          </Button>
        </form>

        {isEdit && detail && (
          <div className="flex w-full min-w-0 flex-col gap-6 xl:max-w-xl">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Used in {detail.products.length} product{detail.products.length === 1 ? "" : "s"}</h2>
              {detail.products.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Not mapped to any product yet. Map it from a product's edit page.
                </p>
              ) : (
                <ul className="mt-3 flex max-h-64 flex-col divide-y divide-zinc-100 overflow-y-auto">
                  {detail.products.map((p) => (
                    <li key={p.handle} className="flex items-center gap-3 py-2 text-sm">
                      <img src={p.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                      <Link to={`/admin/products/${p.handle}/edit`} className="flex-1 truncate hover:underline">
                        {p.title}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">
                        {formatQty(p.quantity)} {detail.unit} each
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Stock history</h2>
              {detail.movements.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No stock changes yet.</p>
              ) : (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">When</th>
                      <th className="py-2 pr-3">What</th>
                      <th className="py-2 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.movements.map((m) => {
                      const change = toNumber(m.change);
                      return (
                        <tr key={m.id} className="border-t border-zinc-100 align-top">
                          <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                            {formatDateTime(m.created_at)}
                          </td>
                          <td className="py-2 pr-3">
                            {REASON_LABELS[m.reason] ?? m.reason}
                            {m.order_id && (
                              <>
                                {" "}
                                <Link to={`/admin/orders/${m.order_id}`} className="text-[hsl(var(--admin-accent))] hover:underline">
                                  #{m.order_id}
                                </Link>
                              </>
                            )}
                            {(m.note || m.admin_name) && (
                              <p className="text-xs text-muted-foreground">
                                {[m.note, m.admin_name && `by ${m.admin_name}`].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </td>
                          <td
                            className={cn(
                              "py-2 text-right font-medium tabular-nums",
                              change < 0 ? "text-destructive" : "text-[hsl(var(--admin-accent))]",
                            )}
                          >
                            {change > 0 ? "+" : ""}
                            {formatQty(change)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
      </div>

      <AdjustStockDialog
        accessory={adjustOpen ? detail : null}
        onClose={() => setAdjustOpen(false)}
        onSaved={() => {
          setAdjustOpen(false);
          loadDetail();
        }}
      />
    </AdminLayout>
  );
}
