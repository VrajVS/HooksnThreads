import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, Plus, Search, UserRound } from "lucide-react";

import { AdminLayout } from "@/components/admin-layout";
import { AdminPagination } from "@/components/admin-pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  type OrderStatus,
  formatDateTime,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const STATUS_FILTERS: (OrderStatus | "")[] = ["", "pending", "confirmed", "completed", "cancelled"];

interface OrderRow {
  id: number;
  source: "admin" | "storefront";
  status: OrderStatus;
  customer_name: string;
  customer_phone: string | null;
  subtotal: number;
  item_count: number;
  created_at: string;
}

export function AdminOrdersPage() {
  const navigate = useNavigate();
  const canCreate = useHasPermission("orders.create");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (status) query.set("status", status);
    api
      .get<{ items: OrderRow[]; total: number; pending_count: number }>(`/admin/orders?${query}`)
      .then((res) => {
        setOrders(res.items);
        setTotal(res.total);
        setPendingCount(res.pending_count);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load orders"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, search, status]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Orders</h1>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Order #, name or phone..."
                className="ml-2 w-full bg-transparent text-sm focus:outline-none"
              />
            </div>
            {canCreate && (
              <Button asChild variant="accent">
                <Link to="/admin/orders/new">
                  <Plus className="h-4 w-4" />
                  New Order
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || "all"}
              role="tab"
              aria-selected={status === s}
              onClick={() => {
                setPage(1);
                setStatus(s);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                status === s
                  ? "bg-[hsl(var(--admin-accent))] text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {s ? ORDER_STATUS_LABELS[s] : "All"}
              {s === "pending" && pendingCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    status === s ? "bg-white/20" : "bg-amber-100 text-amber-800",
                  )}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <p className="text-destructive">{error}</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={load}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {search || status ? "No orders matched." : "No orders yet."}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                      className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          #{order.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p>{order.customer_name}</p>
                        {order.customer_phone && (
                          <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {order.source === "storefront" ? (
                            <Globe className="h-3.5 w-3.5" />
                          ) : (
                            <UserRound className="h-3.5 w-3.5" />
                          )}
                          {order.source === "storefront" ? "Website" : "Admin"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{order.item_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">₹{order.subtotal}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", ORDER_STATUS_STYLES[order.status])}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDateTime(order.created_at)}
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
    </AdminLayout>
  );
}
