import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
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
import { OrderActivity, type OrderEvent, StageTracker } from "@/components/order-timeline";
import { ShortageDialog, shortagesFromError } from "@/components/shortage-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  PAYMENT_MODE_LABELS,
  type OrderCharge,
  type OrderItem,
  type OrderPayment,
  type OrderPaymentMode,
  type OrderStage,
  type OrderStatus,
  type Qty,
  type Requirement,
  formatDate,
  formatDateTime,
  formatQty,
  formatRupees,
  paymentModeLabel,
  todayIso,
  toNumber,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { RequirementsTable } from "@/pages/admin/order-form";
import { StageBadge } from "@/pages/admin/orders";

export interface OrderDetail {
  id: number;
  invoice_number: string;
  order_date: string;
  source: "admin" | "storefront";
  status: OrderStatus;
  stage: OrderStage;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_address: string | null;
  notes: string | null;
  subtotal: number;
  charges_total: number;
  total: number;
  paid: number;
  balance: number;
  delivered: boolean;
  delivery_date: string | null;
  payment_mode: OrderPaymentMode | null;
  stock_deducted: boolean;
  created_at: string;
  created_by: string | null;
  items: OrderItem[];
  charges: OrderCharge[];
  payments: OrderPayment[];
  requirements: Requirement[];
  events: OrderEvent[];
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

const cellInput =
  "rounded-xl border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))] disabled:bg-zinc-50";

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
      toast.success(`Order ${ORDER_STATUS_LABELS[status].toLowerCase()}`);
      load();
    } catch (err) {
      const found = shortagesFromError(err);
      if (found) setShortages(found);
      else toast.error(err instanceof ApiError ? err.message : "Failed to update order");
    } finally {
      setBusy(null);
    }
  };

  const patchItem = async (item: OrderItem, patch: { prepared?: boolean; work_note?: string }) => {
    setOrder((o) => o && { ...o, items: o.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) });
    try {
      await api.patch(`/admin/orders/${id}/items/${item.id}`, patch);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update item");
      load();
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/orders/${id}`);
      toast.success("Order deleted");
      navigate("/admin/orders");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete order");
    }
  };

  if (error) {
    return (
      <AdminLayout>
        <p className="text-destructive">{error}</p>
        <Link to="/admin/orders" className="mt-3 inline-block text-sm hover:underline">Back to orders</Link>
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

  const editable = canUpdate && order.status !== "cancelled";
  const taken = new Map<number, { name: string; unit: string; amount: number }>();
  for (const m of order.movements) {
    const entry = taken.get(m.accessory_id) ?? { name: m.name, unit: m.unit, amount: 0 };
    entry.amount -= toNumber(m.change);
    taken.set(m.accessory_id, entry);
  }
  const takenRows = [...taken.entries()].filter(([, v]) => v.amount !== 0);
  const preparedCount = order.items.filter((i) => i.prepared).length;

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
      <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tabular-nums">Invoice #{order.invoice_number}</h1>
        <StageBadge stage={order.stage} />
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", ORDER_STATUS_STYLES[order.status])}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          {order.source === "storefront" ? <Globe className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
          {order.source === "storefront" ? "Website order" : `Entered by ${order.created_by ?? "admin"}`}
          {" · "}
          {formatDate(order.order_date)}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/orders/${order.id}/invoice`}>
              <FileText className="h-4 w-4" />
              Invoice
            </Link>
          </Button>
          {editable && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/orders/${order.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
          {canUpdate && order.status === "pending" &&
            actionButton("confirmed", "Confirm order", <CheckCircle2 className="h-4 w-4" />, "accent")}
          {canUpdate && order.status === "confirmed" &&
            actionButton("completed", "Mark completed", <PackageCheck className="h-4 w-4" />, "accent")}
          {canUpdate && order.status !== "cancelled" &&
            actionButton("cancelled", "Cancel order", <XCircle className="h-4 w-4" />, "outline")}
          {canDelete && !order.stock_deducted && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <StageTracker stage={order.stage} events={order.events} />
      </div>

      <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="flex w-full min-w-0 max-w-3xl flex-col gap-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Items</h2>
              <span className="text-sm text-muted-foreground">
                {preparedCount}/{order.items.length} prepared
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 py-2 pr-2">
                      <span className="sr-only">Prepared</span>
                    </th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <ItemRow key={item.id} item={item} editable={editable} onPatch={(patch) => patchItem(item, patch)} />
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr className="border-t border-zinc-200">
                    <td colSpan={4} className="py-2 pr-3 text-right text-muted-foreground">Items</td>
                    <td className="py-2 text-right tabular-nums">{formatRupees(order.subtotal)}</td>
                  </tr>
                  {order.charges.map((c) => (
                    <tr key={c.id}>
                      <td colSpan={4} className="py-1 pr-3 text-right text-muted-foreground">{c.label}</td>
                      <td className="py-1 text-right tabular-nums">
                        {c.amount < 0 ? "−" : ""}{formatRupees(Math.abs(c.amount))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-zinc-200 text-base font-semibold">
                    <td colSpan={4} className="py-2 pr-3 text-right">Total</td>
                    <td className="py-2 text-right tabular-nums">{formatRupees(order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
            <h2 className="text-base font-semibold sm:col-span-2">Client</h2>
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

          <OrderActivity events={order.events} />
        </div>

        <aside className="flex w-full max-w-3xl flex-col gap-6 xl:max-w-sm">
          <PaymentsCard order={order} editable={editable} onChanged={load} />
          <DeliveryCard order={order} editable={editable} onChanged={load} />

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            {order.stock_deducted ? (
              <>
                <h2 className="font-semibold">Accessories taken from stock</h2>
                {takenRows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No mapped accessories were used.</p>
                ) : (
                  <ul className="mt-3 flex flex-col divide-y divide-zinc-100 text-sm">
                    {takenRows.map(([accessoryId, t]) => (
                      <li key={accessoryId} className="flex justify-between gap-3 py-1.5">
                        <Link to={`/admin/accessories/${accessoryId}/edit`} className="hover:underline">{t.name}</Link>
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
                  <p className="mt-2 text-sm text-muted-foreground">This order is cancelled and holds no stock.</p>
                ) : order.requirements.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No mapped accessories, so confirming won't change stock.</p>
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
            <AlertDialogTitle>Cancel invoice #{order.invoice_number}?</AlertDialogTitle>
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
            <AlertDialogTitle>Delete invoice #{order.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the order, its items and payments.</AlertDialogDescription>
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

function ItemRow({
  item,
  editable,
  onPatch,
}: {
  item: OrderItem;
  editable: boolean;
  onPatch: (patch: { prepared?: boolean; work_note?: string }) => void;
}) {
  const [note, setNote] = useState(item.work_note ?? "");
  useEffect(() => setNote(item.work_note ?? ""), [item.work_note]);

  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="py-3 pr-2">
        <input
          type="checkbox"
          checked={Boolean(item.prepared)}
          disabled={!editable}
          onChange={(e) => onPatch({ prepared: e.target.checked })}
          aria-label={`${item.title} prepared`}
          className="h-4 w-4 accent-[hsl(var(--admin-accent))]"
        />
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-start gap-3">
          {item.image ? (
            <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-full bg-zinc-100" />
          )}
          <div className="min-w-0 flex-1">
            {item.handle ? (
              <Link to={`/admin/products/${item.handle}/edit`} className={cn("font-medium hover:underline", item.prepared && "text-muted-foreground line-through")}>
                {item.title}
              </Link>
            ) : (
              <span className={cn("font-medium", item.prepared && "text-muted-foreground line-through")}>{item.title}</span>
            )}
            {!item.prepared && (
              <input
                aria-label={`What is left to do for ${item.title}`}
                value={note}
                disabled={!editable}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (item.work_note ?? "") && onPatch({ work_note: note })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                placeholder="What is left to do..."
                className={cn(cellInput, "mt-1.5 w-full text-xs")}
              />
            )}
          </div>
        </div>
      </td>
      <td className="py-3 pr-3 text-right tabular-nums">{item.quantity}</td>
      <td className="py-3 pr-3 text-right tabular-nums">{formatRupees(item.unit_price)}</td>
      <td className="py-3 text-right tabular-nums">{formatRupees(item.unit_price * item.quantity)}</td>
    </tr>
  );
}

function PaymentsCard({ order, editable, onChanged }: { order: OrderDetail; editable: boolean; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"online" | "cash">("online");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Math.round(Number(amount));
    if (!value || value <= 0) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/admin/orders/${order.id}/payments`, { amount: value, mode, paid_on: paidOn, note: note || null });
      setAmount("");
      setNote("");
      toast.success("Payment recorded");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: OrderPayment) => {
    try {
      await api.delete(`/admin/orders/${order.id}/payments/${p.id}`);
      toast.success("Payment removed");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove payment");
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Payment</h2>
        <span className="text-xs text-muted-foreground">
          Mode: <span className="font-medium text-foreground">{paymentModeLabel(order.payment_mode, order.payments) ?? "Not decided"}</span>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-xl bg-zinc-50 p-2">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="font-semibold tabular-nums">{formatRupees(order.total)}</dd>
        </div>
        <div className="rounded-xl bg-zinc-50 p-2">
          <dt className="text-xs text-muted-foreground">Received</dt>
          <dd className="font-semibold tabular-nums">{formatRupees(order.paid)}</dd>
        </div>
        <div className={cn("rounded-xl p-2", order.balance > 0 ? "bg-fuchsia-50 text-fuchsia-800" : "bg-emerald-50 text-emerald-800")}>
          <dt className="text-xs opacity-80">{order.balance < 0 ? "Overpaid" : "Balance"}</dt>
          <dd className="font-semibold tabular-nums">{formatRupees(Math.abs(order.balance))}</dd>
        </div>
      </dl>

      {order.payments.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100 text-sm">
          {order.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2">
              <span className="flex-1">
                <span className="font-medium tabular-nums">{formatRupees(p.amount)}</span>{" "}
                <span className="text-muted-foreground">{PAYMENT_MODE_LABELS[p.mode]}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(p.paid_on)}
                  {p.note && ` · ${p.note}`}
                </span>
              </span>
              {editable && (
                <button
                  onClick={() => remove(p)}
                  aria-label={`Remove payment of ${formatRupees(p.amount)}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form onSubmit={add} noValidate className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-2">
            <input
              aria-label="Payment amount"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={order.balance > 0 ? `₹${order.balance}` : "₹"}
              className={cn(cellInput, "min-w-0 flex-1 py-2")}
            />
            <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1">
              {(["online", "cash"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium capitalize", mode === m ? "bg-white shadow-sm" : "text-zinc-500")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input aria-label="Paid on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={cn(cellInput, "py-2")} />
            <input
              aria-label="Payment note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (e.g. advance)"
              className={cn(cellInput, "min-w-0 flex-1 py-2")}
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Record payment
          </Button>
        </form>
      )}
    </section>
  );
}

function DeliveryCard({ order, editable, onChanged }: { order: OrderDetail; editable: boolean; onChanged: () => void }) {
  const [date, setDate] = useState(order.delivery_date ?? "");
  useEffect(() => setDate(order.delivery_date ?? ""), [order.delivery_date]);

  const save = async (delivered: boolean, deliveryDate: string) => {
    try {
      await api.patch(`/admin/orders/${order.id}/delivery`, { delivered, delivery_date: deliveryDate || null });
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update delivery");
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="font-semibold">Delivery</h2>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={order.delivered}
          disabled={!editable}
          onChange={(e) => save(e.target.checked, e.target.checked && !date ? todayIso() : date)}
          aria-label="Delivered"
          className="h-4 w-4 accent-[hsl(var(--admin-accent))]"
        />
        <span className="font-medium">Delivered</span>
      </label>
      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor="delivery-date" className="text-xs text-muted-foreground">
          {order.delivered ? "Date of delivery" : "Delivery due by"}
        </label>
        <input
          id="delivery-date"
          type="date"
          value={date}
          disabled={!editable}
          onChange={(e) => {
            setDate(e.target.value);
            save(order.delivered, e.target.value);
          }}
          className={cn(cellInput, "py-2")}
        />
      </div>
    </section>
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
