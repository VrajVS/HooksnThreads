import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Globe, Loader2, PackageCheck, Trash2, UserRound, XCircle } from "lucide-react";
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
import { ShortageDialog, shortagesFromError } from "@/components/shortage-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  type OrderItem,
  type OrderStatus,
  type Qty,
  type Requirement,
  formatDateTime,
  formatQty,
  toNumber,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { RequirementsTable } from "@/pages/admin/order-form";

interface OrderDetail {
  id: number;
  source: "admin" | "storefront";
  status: OrderStatus;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_address: string | null;
  notes: string | null;
  subtotal: number;
  stock_deducted: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  items: OrderItem[];
  requirements: Requirement[];
  movements: {
    id: number;
    change: Qty;
    reason: "order" | "order_cancelled";
    created_at: string;
    accessory_id: number;
    name: string;
    unit: string;
    admin_name: string | null;
  }[];
}

export function AdminOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canUpdate = useHasPermission("orders.update");
  const canDelete = useHasPermission("orders.delete");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [shortages, setShortages] = useState<Requirement[] | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api
      .get<OrderDetail>(`/admin/orders/${id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load order"));
  }, [id]);

  useEffect(load, [load]);

  const setStatus = async (status: OrderStatus, allowShortage = false) => {
    setBusy(status);
    try {
      await api.post(`/admin/orders/${id}/status`, { status, allow_shortage: allowShortage });
      toast.success(`Order #${id} ${ORDER_STATUS_LABELS[status].toLowerCase()}`);
      load();
    } catch (err) {
      const found = shortagesFromError(err);
      if (found) setShortages(found);
      else toast.error(err instanceof ApiError ? err.message : "Failed to update order");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/orders/${id}`);
      toast.success(`Order #${id} deleted`);
      navigate("/admin/orders");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete order");
    }
  };

  if (error) {
    return (
      <AdminLayout>
        <p className="text-destructive">{error}</p>
        <Link to="/admin/orders" className="mt-3 inline-block text-sm hover:underline">
          Back to orders
        </Link>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full max-w-3xl rounded-2xl" />
      </AdminLayout>
    );
  }

  // Net amount this order currently holds, per accessory.
  const taken = new Map<number, { name: string; unit: string; amount: number }>();
  for (const m of order.movements) {
    const entry = taken.get(m.accessory_id) ?? { name: m.name, unit: m.unit, amount: 0 };
    entry.amount -= toNumber(m.change);
    taken.set(m.accessory_id, entry);
  }
  const takenRows = [...taken.entries()].filter(([, v]) => v.amount !== 0);

  const actionButton = (status: OrderStatus, label: string, icon: React.ReactNode, variant: "accent" | "outline") => (
    <Button
      variant={variant}
      size="sm"
      disabled={busy !== null}
      onClick={() => (status === "cancelled" ? setConfirmCancel(true) : setStatus(status))}
    >
      {busy === status ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  return (
    <AdminLayout>
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Order #{order.id}</h1>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", ORDER_STATUS_STYLES[order.status])}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          {order.source === "storefront" ? <Globe className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
          {order.source === "storefront" ? "Placed on website" : `Entered by ${order.created_by ?? "admin"}`}
          {" · "}
          {formatDateTime(order.created_at)}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          {canUpdate && order.status === "pending" &&
            actionButton("confirmed", "Confirm order", <CheckCircle2 className="h-4 w-4" />, "accent")}
          {canUpdate && order.status === "confirmed" &&
            actionButton("completed", "Mark completed", <PackageCheck className="h-4 w-4" />, "accent")}
          {canUpdate && order.status !== "cancelled" &&
            actionButton("cancelled", "Cancel order", <XCircle className="h-4 w-4" />, "outline")}
          {canDelete && !order.stock_deducted && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex w-full min-w-0 max-w-3xl flex-col gap-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Items</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-100" />
                        )}
                        {item.handle ? (
                          <Link to={`/admin/products/${item.handle}/edit`} className="font-medium hover:underline">
                            {item.title}
                          </Link>
                        ) : (
                          <span className="font-medium">
                            {item.title} <span className="text-xs font-normal text-muted-foreground">(deleted product)</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">₹{item.unit_price}</td>
                    <td className="py-2 text-right tabular-nums">₹{item.unit_price * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 font-semibold">
                  <td colSpan={3} className="py-2 pr-3 text-right">Subtotal</td>
                  <td className="py-2 text-right tabular-nums">₹{order.subtotal}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="grid gap-4 rounded-2xl bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
            <h2 className="text-base font-semibold sm:col-span-2">Customer</h2>
            <Field label="Name" value={order.customer_name} />
            <Field label="Phone" value={order.customer_phone} />
            <Field label="Email / Instagram" value={order.customer_email} />
            <Field label="Delivery address" value={order.shipping_address} />
            {order.notes && (
              <div className="sm:col-span-2">
                <Field label="Notes" value={order.notes} />
              </div>
            )}
          </section>
        </div>

        <aside className="flex w-full max-w-3xl flex-col gap-6 xl:max-w-sm">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            {order.stock_deducted ? (
              <>
                <h2 className="font-semibold">Accessories taken from stock</h2>
                {takenRows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    None of these products had accessories mapped when the order was confirmed.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col divide-y divide-zinc-100 text-sm">
                    {takenRows.map(([accessoryId, t]) => (
                      <li key={accessoryId} className="flex justify-between gap-3 py-1.5">
                        <Link to={`/admin/accessories/${accessoryId}/edit`} className="hover:underline">
                          {t.name}
                        </Link>
                        <span className="tabular-nums">{formatQty(t.amount)} {t.unit}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <h2 className="font-semibold">
                  {order.status === "cancelled" ? "Accessories" : "Accessories needed to confirm"}
                </h2>
                {order.status === "cancelled" ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    This order is cancelled and holds no stock.
                  </p>
                ) : order.requirements.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    These products have no accessories mapped, so confirming won't change stock.
                  </p>
                ) : (
                  <div className="mt-3">
                    <RequirementsTable requirements={order.requirements} />
                  </div>
                )}
              </>
            )}
          </section>

          {order.movements.length > 0 && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Stock history</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {order.movements.map((m) => {
                  const change = toNumber(m.change);
                  return (
                    <li key={m.id} className="flex justify-between gap-3">
                      <span>
                        {m.name}
                        <span className="block text-xs text-muted-foreground">
                          {m.reason === "order" ? "Deducted" : "Restored"} · {formatDateTime(m.created_at)}
                          {m.admin_name && ` · ${m.admin_name}`}
                        </span>
                      </span>
                      <span className={cn("font-medium tabular-nums", change < 0 ? "text-destructive" : "text-[hsl(var(--admin-accent))]")}>
                        {change > 0 ? "+" : ""}
                        {formatQty(change)} {m.unit}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <ShortageDialog
        shortages={shortages}
        onCancel={() => setShortages(null)}
        onProceed={() => {
          setShortages(null);
          setStatus("confirmed", true);
        }}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              {order.stock_deducted
                ? "The accessories this order used will be added back to stock. A cancelled order can't be reopened."
                : "A cancelled order can't be reopened."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setStatus("cancelled")}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order #{order.id}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the order and its items.</AlertDialogDescription>
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-line">{value || "—"}</p>
    </div>
  );
}
