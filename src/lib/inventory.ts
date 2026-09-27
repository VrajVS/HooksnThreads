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
