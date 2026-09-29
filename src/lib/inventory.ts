// The API serialises NUMERIC columns as numbers (or strings on some paths), so
// every quantity goes through toNumber before display or arithmetic.
export type Qty = number | string;

export interface AccessoryOption {
  id: number;
  name: string;
  unit: string;
  stock: Qty;
}

export interface Accessory extends AccessoryOption {
  low_stock_threshold: Qty;
  updated_at: string;
  product_count?: number;
}

export interface Requirement {
  accessory_id: number;
  name: string;
  unit: string;
  stock: Qty;
  required: Qty;
  shortage: Qty;
}

export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface OrderItem {
  id: number;
  handle: string | null;
  title: string;
  unit_price: number;
  quantity: number;
  image: string | null;
  prepared?: boolean;
  work_note?: string | null;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-[hsl(var(--admin-accent-light))] text-[hsl(var(--admin-accent))]",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-zinc-100 text-zinc-500",
};

export function toNumber(value: Qty | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function formatQty(value: Qty | null | undefined): string {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

export function isLowStock(a: { stock: Qty; low_stock_threshold: Qty }): boolean {
  return toNumber(a.stock) <= toNumber(a.low_stock_threshold);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type OrderStage =
  | "preparation_pending"
  | "in_progress"
  | "delivery_pending"
  | "payment_pending"
  | "done"
  | "cancelled";

// Same colour key as the studio's order spreadsheet; `dot` is the sheet's exact colour.
export const ORDER_STAGES: Record<OrderStage, { label: string; className: string; dot: string }> = {
  preparation_pending: { label: "Preparation pending", className: "bg-red-100 text-red-800", dot: "#ff0000" },
  in_progress: { label: "Work in progress", className: "bg-orange-100 text-orange-800", dot: "#ff9900" },
  delivery_pending: { label: "Delivery pending", className: "bg-yellow-100 text-yellow-900", dot: "#ffd400" },
  payment_pending: { label: "Payment pending", className: "bg-fuchsia-100 text-fuchsia-800", dot: "#ff00ff" },
  done: { label: "Done", className: "bg-emerald-100 text-emerald-800", dot: "#10b981" },
  cancelled: { label: "Cancelled", className: "bg-zinc-100 text-zinc-500", dot: "#a1a1aa" },
};

export const PAYMENT_MODE_LABELS: Record<string, string> = { online: "Online", cash: "Cash" };

export type OrderPaymentMode = "online" | "cash" | "online_cash";

export const ORDER_PAYMENT_MODES: { value: OrderPaymentMode; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "cash", label: "Cash" },
  { value: "online_cash", label: "Online + Cash" },
];

/** The order's mode of payment: what was actually paid, else what was agreed. */
export function paymentModeLabel(
  planned: OrderPaymentMode | null | undefined,
  payments: { mode: string }[] = [],
): string | null {
  const paid = [...new Set(payments.map((p) => p.mode))];
  if (paid.length === 2) return "Online + Cash";
  if (paid.length === 1) return PAYMENT_MODE_LABELS[paid[0]];
  return ORDER_PAYMENT_MODES.find((m) => m.value === planned)?.label ?? null;
}

export interface OrderCharge {
  id?: number;
  label: string;
  amount: number;
}

export interface OrderPayment {
  id: number;
  amount: number;
  mode: "online" | "cash";
  paid_on: string;
  note: string | null;
  admin_name: string | null;
}

export interface BusinessSettings {
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoice_footer: string;
}

/** "2026-09-28" -> "28 Sept 2026" without timezone drift. */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
