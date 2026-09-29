import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Globe, Plus, Search, Settings2 } from "lucide-react";

import { AdminLayout } from "@/components/admin-layout";
import { AdminPagination } from "@/components/admin-pagination";
import { InvoiceSettingsDialog } from "@/components/invoice-settings-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";
import {
  ORDER_STAGES,
  type OrderStage,
  type OrderStatus,
  PAYMENT_MODE_LABELS,
  formatDate,
  formatMonth,
  formatRupees,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const STAGE_FILTERS: OrderStage[] = [
  "preparation_pending",
  "in_progress",
  "delivery_pending",
  "payment_pending",
  "done",
  "cancelled",
];

type Tab = "orders" | "pending" | "sold";

interface OrderRow {
  id: number;
  invoice_number: string;
  order_date: string;
  source: "admin" | "storefront";
  status: OrderStatus;
  stage: OrderStage;
  customer_name: string;
  customer_phone: string | null;
  total: number;
  paid: number;
  delivered: boolean;
  delivery_date: string | null;
  line_count: number;
  prepared_count: number;
  item_count: number;
  items_summary: string;
  payment_modes: string | null;
}

interface ListResponse {
  items: OrderRow[];
  total: number;
  summary: { orders: number; total: number; received: number; outstanding: number };
  stage_counts: Partial<Record<OrderStage, number>>;
  months: string[];
}

export function StageBadge({ stage }: { stage: OrderStage }) {
  const s = ORDER_STAGES[stage];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", s.className)}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

function paymentModes(modes: string | null) {
  if (!modes) return "—";
  return modes
    .split("+")
    .map((m) => PAYMENT_MODE_LABELS[m] ?? m)
    .join(" + ");
}

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "orders";
  const canCreate = useHasPermission("orders.create");
  const canUpdate = useHasPermission("orders.update");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "orders") next.delete("tab");
    else next.set("tab", t);
    setParams(next, { replace: true });
  };

  return (
    <AdminLayout>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Orders</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canUpdate && (
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" />
                Invoice details
              </Button>
            )}
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

        <div className="mt-4 flex shrink-0 gap-1 border-b border-zinc-200" role="tablist">
          {([
            ["orders", "Orders"],
            ["pending", "Pending work"],
            ["sold", "Items sold"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                tab === key
                  ? "border-[hsl(var(--admin-accent))] text-[hsl(var(--admin-accent))]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "orders" && <OrdersTab initialStage={(params.get("stage") as OrderStage | null) ?? ""} />}
        {tab === "pending" && <PendingWorkTab />}
        {tab === "sold" && <ItemsSoldTab />}
      </div>

      <InvoiceSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AdminLayout>
  );
}

function OrdersTab({ initialStage }: { initialStage: OrderStage | "" }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState<OrderStage | "">(STAGE_FILTERS.includes(initialStage as OrderStage) ? initialStage : "");
  const [month, setMonth] = useState("");
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
    if (stage) query.set("stage", stage);
    if (month) query.set("month", month);
    api
      .get<ListResponse>(`/admin/orders?${query}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load orders"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, search, stage, month]);

  const orders = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2">
        <select
          aria-label="Month"
          value={month}
          onChange={(e) => {
            setPage(1);
            setMonth(e.target.value);
          }}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
        >
          <option value="">All months</option>
          {data?.months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <div className="flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 sm:w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Invoice #, client, phone or item..."
            aria-label="Search orders"
            className="ml-2 w-full bg-transparent text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap gap-2" aria-label="Filter by stage">
        <button
          onClick={() => {
            setPage(1);
            setStage("");
          }}
          aria-pressed={stage === ""}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            stage === "" ? "bg-[hsl(var(--admin-accent))] text-white" : "bg-white text-zinc-600 hover:bg-zinc-50",
          )}
        >
          All
        </button>
        {STAGE_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setPage(1);
              setStage(s);
            }}
            aria-pressed={stage === s}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              stage === s ? "bg-[hsl(var(--admin-accent))] text-white" : "bg-white text-zinc-600 hover:bg-zinc-50",
            )}
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: ORDER_STAGES[s].dot }} />
            {ORDER_STAGES[s].label}
            <span className={cn("text-xs tabular-nums", stage === s ? "text-white/80" : "text-zinc-400")}>
              {data?.stage_counts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Prepared</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-14" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    {search || stage || month ? "No orders matched." : "No orders yet."}
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/admin/orders/${o.id}`)}
                    className="cursor-pointer border-b border-zinc-100 align-top last:border-0 hover:bg-zinc-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      <Link to={`/admin/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        {o.invoice_number}
                      </Link>
                      {o.source === "storefront" && (
                        <Globe className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground" aria-label="Website order" />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(o.order_date)}</td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap">{o.customer_name}</p>
                      {o.customer_phone && <p className="text-xs text-muted-foreground">{o.customer_phone}</p>}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="line-clamp-2" title={o.items_summary}>{o.items_summary}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.item_count}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRupees(o.total)}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-right tabular-nums",
                        o.status !== "cancelled" && o.paid < o.total && "text-fuchsia-700",
                      )}
                    >
                      {formatRupees(o.paid)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{paymentModes(o.payment_modes)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {o.prepared_count === o.line_count ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-4 w-4" />Yes</span>
                      ) : (
                        <span className="text-muted-foreground">{o.prepared_count}/{o.line_count}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {o.delivered ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Check className="h-4 w-4" />
                          {o.delivery_date ? formatDate(o.delivery_date) : "Yes"}
                        </span>
                      ) : o.delivery_date ? (
                        <span className="text-muted-foreground">Due {formatDate(o.delivery_date)}</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={o.stage} /></td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && !error && data && data.summary.orders > 0 && (
              <tfoot className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50 text-sm font-semibold">
                <tr>
                  <td colSpan={5} className="px-4 py-3">
                    Total · {data.summary.orders} order{data.summary.orders === 1 ? "" : "s"}
                    <span className="ml-1 font-normal text-muted-foreground">(excl. cancelled)</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRupees(data.summary.total)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRupees(data.summary.received)}</td>
                  <td colSpan={4} className="px-4 py-3 font-normal text-fuchsia-700">
                    {data.summary.outstanding > 0 && `${formatRupees(data.summary.outstanding)} still to collect`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!loading && !error && <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </div>
    </>
  );
}

interface PendingItem {
  id: number;
  order_id: number;
  invoice_number: string;
  order_date: string;
  customer_name: string;
  title: string;
  quantity: number;
  work_note: string | null;
  delivery_date: string | null;
  image: string | null;
}

function PendingWorkTab() {
  const canUpdate = useHasPermission("orders.update");
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<PendingItem[]>("/admin/orders/pending-items")
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load pending work"));
  };
  useEffect(load, []);

  const markPrepared = async (item: PendingItem) => {
    try {
      await api.patch(`/admin/orders/${item.order_id}/items/${item.id}`, { prepared: true });
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update item");
    }
  };

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">What is left to do</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-destructive">{error}</td></tr>
            ) : items === null ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nothing left to make.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3">{item.customer_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.image && <img src={item.image} alt="" className="h-8 w-8 rounded-full object-cover" />}
                      <span>{item.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.work_note || "Not started"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(item.delivery_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link to={`/admin/orders/${item.order_id}`} className="font-medium hover:underline">{item.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canUpdate && (
                      <Button variant="outline" size="sm" onClick={() => markPrepared(item)}>
                        <Check className="h-4 w-4" />
                        Prepared
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ItemsSold {
  year: number;
  years: number[];
  by_month: { month: string; item: string; pieces: number; revenue: number }[];
  totals: { item: string; pieces: number; revenue: number }[];
}

function ItemsSoldTab() {
  const [year, setYear] = useState<number | null>(null);
  const [data, setData] = useState<ItemsSold | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ItemsSold>(`/admin/orders/items-sold${year ? `?year=${year}` : ""}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load items sold"));
  }, [year]);

  const months: [string, ItemsSold["by_month"]][] = [];
  for (const row of data?.by_month ?? []) {
    const last = months[months.length - 1];
    if (last && last[0] === row.month) last[1].push(row);
    else months.push([row.month, [row]]);
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div className="flex items-center gap-3">
        <select
          aria-label="Year"
          value={data?.year ?? ""}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
        >
          {data?.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <p className="text-sm text-muted-foreground">Cancelled orders are not counted.</p>
      </div>
      {error ? (
        <p className="text-destructive">{error}</p>
      ) : !data ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : data.totals.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-muted-foreground shadow-sm">No items sold in {data.year}.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">By month</h2>
            {months.map(([month, rows]) => (
              <div key={month} className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{formatMonth(month)}</h3>
                <table className="mt-1 w-full text-sm">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.item} className="border-t border-zinc-100">
                        <td className="py-1.5 pr-3">{r.item}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.pieces} pcs</td>
                        <td className="w-24 py-1.5 text-right tabular-nums text-muted-foreground">{formatRupees(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm lg:sticky lg:top-0">
            <h2 className="font-semibold">Total pieces sold in {data.year}</h2>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {data.totals.map((t) => (
                  <tr key={t.item} className="border-t border-zinc-100">
                    <td className="py-1.5 pr-3">{t.item}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{t.pieces}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
