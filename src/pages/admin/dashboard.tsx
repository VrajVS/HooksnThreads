import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Globe,
  IndianRupee,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAuth } from "@/context/admin-auth-context";
import { useHasPermission } from "@/hooks/use-has-permission";
import { ApiError, api } from "@/lib/api";
import {
  ORDER_STAGES,
  type OrderStage,
  type Qty,
  formatDate,
  formatQty,
  formatRupees,
  todayIso,
  toNumber,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { StageBadge } from "@/pages/admin/orders";

type Period = "month" | "30d" | "year" | "all";

const PERIODS: { key: Period; label: string; compare: string }[] = [
  { key: "month", label: "This month", compare: "vs same days last month" },
  { key: "30d", label: "Last 30 days", compare: "vs previous 30 days" },
  { key: "year", label: "This year", compare: "vs same period last year" },
  { key: "all", label: "All time", compare: "" },
];

const PIPELINE: OrderStage[] = ["preparation_pending", "in_progress", "delivery_pending", "payment_pending"];

interface Sales {
  revenue: number;
  orders: number;
  average_order: number;
  previous: { orders: number; revenue: number } | null;
  received: number;
  outstanding: number;
  outstanding_orders: number;
  monthly: { month: string; revenue: number; orders: number }[];
  stage_counts: Partial<Record<OrderStage, number>>;
  to_confirm: { id: number; invoice_number: string; customer_name: string; total: number; order_date: string; source: string }[];
  deliveries: { id: number; invoice_number: string; customer_name: string; delivery_date: string; stage: OrderStage; items_left: number }[];
  to_collect: { id: number; invoice_number: string; customer_name: string; balance: number }[];
  top_items: { item: string; pieces: number; revenue: number; image: string | null }[];
  recent: { id: number; invoice_number: string; customer_name: string; total: number; paid: number; stage: OrderStage; order_date: string; source: string }[];
  customers: { total: number; new: number };
}

interface Dashboard {
  period: Period;
  start: string | null;
  today: string;
  sales?: Sales;
  inventory?: { total: number; low: number; items: { id: number; name: string; unit: string; stock: Qty; low_stock_threshold: Qty }[] };
  catalogue?: { products: number; featured: number; unmapped: number; categories: number };
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function monthLabel(yyyyMm: string, style: "short" | "long" = "short") {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", style === "short" ? { month: "short" } : { month: "long", year: "numeric" });
}

function compactRupees(n: number) {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n >= 10_00_000 ? 0 : 1).replace(/\.0$/, "")}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `₹${n}`;
}

/** Round the axis max up to 1/2/2.5/5 × 10^n so ticks land on clean numbers. */
function niceMax(value: number) {
  if (value <= 0) return 1000;
  const exp = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= value) return step * exp;
  return 10 * exp;
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl bg-white p-5 shadow-sm", className)}>{children}</section>;
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function ViewAll({ to, label = "View all" }: { to: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--admin-accent))] hover:underline">
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) {
    return current > 0 ? <span className="text-xs font-medium text-emerald-700">New this period</span> : null;
  }
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-emerald-700" : "text-red-700")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? "+" : "−"}
      {Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}%
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  footer,
  to,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  footer?: React.ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--admin-accent-light))] text-[hsl(var(--admin-accent))]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <div className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground">{footer}</div>
    </>
  );
  const className = "rounded-2xl bg-white p-5 shadow-sm";
  return to ? (
    <Link to={to} className={cn(className, "transition-shadow hover:shadow-md")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function RevenueChart({ monthly }: { monthly: Sales["monthly"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = niceMax(Math.max(...monthly.map((m) => m.revenue)));
  const ticks = [max, max / 2, 0];
  const total = monthly.reduce((sum, m) => sum + m.revenue, 0);
  const current = monthly[monthly.length - 1];

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Revenue, last 12 months"
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{formatRupees(total)}</span> total
            </span>
            <div className="grid grid-cols-2 rounded-full bg-zinc-100 p-0.5 text-xs" role="group" aria-label="Chart view">
              {(["Chart", "Table"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAsTable(v === "Table")}
                  aria-pressed={asTable === (v === "Table")}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-medium",
                    asTable === (v === "Table") ? "bg-white shadow-sm" : "text-zinc-500",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {asTable ? (
        <div className="mt-4 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1.5 text-left">Month</th>
                <th className="py-1.5 text-right">Orders</th>
                <th className="py-1.5 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...monthly].reverse().map((m) => (
                <tr key={m.month} className="border-t border-zinc-100">
                  <td className="py-1.5">{monthLabel(m.month, "long")}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.orders}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatRupees(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 flex gap-3">
          <div className="flex h-52 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground">
            {ticks.map((t) => (
              <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{compactRupees(t)}</span>
            ))}
          </div>
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%-1.5rem)]" aria-hidden>
              {ticks.map((t, i) => (
                <div key={t} className="absolute inset-x-0 border-t border-zinc-100" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
              ))}
            </div>
            <div className="relative flex h-52 items-stretch" onMouseLeave={() => setHover(null)}>
              {monthly.map((m, i) => {
                const pct = (m.revenue / max) * 100;
                const isCurrent = i === monthly.length - 1;
                const active = hover === i;
                return (
                  <div
                    key={m.month}
                    className="group relative flex flex-1 flex-col items-center"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${monthLabel(m.month, "long")}: ${formatRupees(m.revenue)} from ${m.orders} order${m.orders === 1 ? "" : "s"}`}
                  >
                    <div className={cn("relative flex w-full flex-1 items-end justify-center rounded-[6px]", active && "bg-zinc-50")}>
                      {isCurrent && m.revenue > 0 && !active && (
                        <span className="absolute -translate-y-full pb-1 text-[11px] font-medium tabular-nums text-foreground" style={{ bottom: `${pct}%` }}>
                          {compactRupees(m.revenue)}
                        </span>
                      )}
                      <div
                        className={cn(
                          "w-full max-w-[24px] rounded-t-[4px] transition-opacity",
                          hover !== null && !active ? "opacity-40" : "opacity-100",
                        )}
                        style={{
                          height: m.revenue > 0 ? `max(${pct}%, 3px)` : "0",
                          backgroundColor: "hsl(var(--admin-accent))",
                        }}
                      />
                      {active && (
                        <div
                          role="tooltip"
                          className={cn(
                            "pointer-events-none absolute z-10 mb-2 w-max rounded-[8px] bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg",
                            i < 2 ? "left-0" : i > monthly.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2",
                          )}
                          style={{ bottom: `${pct}%` }}
                        >
                          <p className="font-medium">{monthLabel(m.month, "long")}</p>
                          <p className="mt-0.5 tabular-nums">{formatRupees(m.revenue)}</p>
                          <p className="tabular-nums text-white/70">{m.orders} order{m.orders === 1 ? "" : "s"}</p>
                        </div>
                      )}
                    </div>
                    <span className={cn("mt-1.5 h-4 text-[11px] text-muted-foreground", isCurrent && "font-semibold text-foreground")}>
                      {monthLabel(m.month)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {!asTable && current && (
        <p className="mt-2 text-xs text-muted-foreground">
          Cancelled orders excluded. Hover a month for details.
        </p>
      )}
    </Card>
  );
}

function Pipeline({ counts }: { counts: Sales["stage_counts"] }) {
  const open = PIPELINE.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  return (
    <Card>
      <CardHeader title="Order pipeline" action={<ViewAll to="/admin/orders" />} />
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{open}</span> open order{open === 1 ? "" : "s"}
      </p>
      <ul className="mt-4 flex flex-col gap-1">
        {PIPELINE.map((stage) => {
          const n = counts[stage] ?? 0;
          return (
            <li key={stage}>
              <Link
                to={`/admin/orders?stage=${stage}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-zinc-50"
              >
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ORDER_STAGES[stage].dot }} />
                <span className="flex-1">{ORDER_STAGES[stage].label}</span>
                <span className={cn("font-semibold tabular-nums", n === 0 && "text-muted-foreground")}>{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-muted-foreground">
        <span>Done: <span className="font-medium text-foreground tabular-nums">{counts.done ?? 0}</span></span>
        <span>Cancelled: <span className="font-medium text-foreground tabular-nums">{counts.cancelled ?? 0}</span></span>
      </div>
    </Card>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
      {children}
    </p>
  );
}

function Attention({ sales, today }: { sales: Sales; today: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader title="To confirm" action={<ViewAll to="/admin/orders" label="Orders" />} />
        <p className="mt-0.5 text-xs text-muted-foreground">Pending orders waiting for you to confirm</p>
        {sales.to_confirm.length === 0 ? (
          <EmptyLine>Nothing waiting</EmptyLine>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {sales.to_confirm.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="flex items-center gap-2 py-2 hover:text-[hsl(var(--admin-accent))]">
                  {o.source === "storefront" && <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Website order" />}
                  <span className="flex-1 truncate">{o.customer_name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatRupees(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Deliveries due" action={<ViewAll to="/admin/orders?tab=pending" label="Pending work" />} />
        <p className="mt-0.5 text-xs text-muted-foreground">Not yet delivered, due within 7 days</p>
        {sales.deliveries.length === 0 ? (
          <EmptyLine>No deliveries due this week</EmptyLine>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {sales.deliveries.map((o) => {
              const overdue = o.delivery_date < today;
              return (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`} className="flex items-center gap-2 py-2 hover:text-[hsl(var(--admin-accent))]">
                    <span className="flex-1 truncate">
                      {o.customer_name}
                      {o.items_left > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {o.items_left} item{o.items_left === 1 ? "" : "s"} still to make
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                        overdue ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      {overdue && <AlertTriangle className="h-3 w-3" aria-hidden />}
                      {overdue ? "Overdue · " : ""}
                      {formatDate(o.delivery_date)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Payments to collect" action={<ViewAll to="/admin/orders" label="Orders" />} />
        <p className="mt-0.5 text-xs text-muted-foreground">Delivered, but not fully paid</p>
        {sales.to_collect.length === 0 ? (
          <EmptyLine>All delivered orders are paid</EmptyLine>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {sales.to_collect.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/orders/${o.id}`} className="flex items-center gap-2 py-2 hover:text-[hsl(var(--admin-accent))]">
                  <span className="flex-1 truncate">{o.customer_name}</span>
                  <span className="font-medium tabular-nums text-fuchsia-700">{formatRupees(o.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function AdminDashboardPage() {
  const { admin } = useAdminAuth();
  const canCreateOrder = useHasPermission("orders.create");
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<Dashboard>(`/admin/dashboard?period=${period}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [period]);

  const periodInfo = PERIODS.find((p) => p.key === period)!;
  const sales = data?.sales;
  const today = data?.today ?? todayIso();
  const firstName = admin?.full_name.split(" ")[0] ?? "";
  const nothingVisible = data && !data.sales && !data.inventory && !data.catalogue;

  const periodLabel = useMemo(() => {
    if (!data?.start) return "Since you started";
    return `${formatDate(data.start)} – ${formatDate(data.today)}`;
  }, [data]);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-5 pb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {greeting()}{firstName && `, ${firstName}`}. Here's how the studio is doing.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-white p-1 shadow-sm" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  aria-pressed={period === p.key}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                    period === p.key ? "bg-[hsl(var(--admin-accent))] text-white" : "text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {canCreateOrder && (
              <Button asChild variant="accent" size="sm">
                <Link to="/admin/orders/new">
                  <Plus className="h-4 w-4" />
                  New Order
                </Link>
              </Button>
            )}
          </div>
        </div>

        {error ? (
          <Card>
            <p className="text-destructive">{error}</p>
          </Card>
        ) : !data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            <Skeleton className="h-72 rounded-2xl sm:col-span-2 xl:col-span-3" />
            <Skeleton className="h-72 rounded-2xl sm:col-span-2" />
          </div>
        ) : nothingVisible ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              Your role doesn't include access to orders, accessories or products, so there's nothing to show here yet.
            </p>
          </Card>
        ) : (
          <div className={cn("flex flex-col gap-5 transition-opacity", loading && "opacity-60")}>
            {sales && (
              <>
                <p className="-mb-2 text-xs text-muted-foreground">{periodLabel}</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Kpi
                    icon={IndianRupee}
                    label="Revenue"
                    value={formatRupees(sales.revenue)}
                    footer={
                      sales.previous && (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <Delta current={sales.revenue} previous={sales.previous.revenue} />
                          {sales.previous.revenue > 0 && <span>{periodInfo.compare}</span>}
                        </span>
                      )
                    }
                  />
                  <Kpi
                    icon={ShoppingBag}
                    label="Orders"
                    value={String(sales.orders)}
                    to="/admin/orders"
                    footer={
                      sales.previous && (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <Delta current={sales.orders} previous={sales.previous.orders} />
                          {sales.previous.orders > 0 && <span>{periodInfo.compare}</span>}
                        </span>
                      )
                    }
                  />
                  <Kpi icon={Receipt} label="Average order" value={formatRupees(sales.average_order)} footer="Per non-cancelled order" />
                  <Kpi icon={Wallet} label="Received" value={formatRupees(sales.received)} footer="Payments recorded in this period" />
                  <Kpi
                    icon={CalendarClock}
                    label="Outstanding"
                    value={formatRupees(sales.outstanding)}
                    to="/admin/orders"
                    footer={
                      sales.outstanding_orders > 0
                        ? `Across ${sales.outstanding_orders} order${sales.outstanding_orders === 1 ? "" : "s"}, all time`
                        : "Nothing owed"
                    }
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <RevenueChart monthly={sales.monthly} />
                  <Pipeline counts={sales.stage_counts} />
                </div>

                <Attention sales={sales} today={today} />
              </>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {sales && (
                <Card>
                  <CardHeader title="Top items" action={<ViewAll to="/admin/orders?tab=sold" label="Items sold" />} />
                  <p className="mt-0.5 text-xs text-muted-foreground">{periodInfo.label}, by pieces sold</p>
                  {sales.top_items.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">No sales in this period yet.</p>
                  ) : (
                    <ol className="mt-3 flex flex-col gap-3">
                      {sales.top_items.map((t, i) => {
                        const top = sales.top_items[0].pieces || 1;
                        return (
                          <li key={t.item} className="flex items-center gap-3 text-sm">
                            <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                            {t.image ? (
                              <img src={t.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <span className="h-8 w-8 rounded-full bg-zinc-100" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-2">
                                <span className="truncate">{t.item}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{t.pieces} pcs</span>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-zinc-100" aria-hidden>
                                <div className="h-1.5 rounded-full bg-[hsl(var(--admin-accent))]" style={{ width: `${(t.pieces / top) * 100}%` }} />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </Card>
              )}

              {data.inventory && (
                <Card>
                  <CardHeader title="Low stock" action={<ViewAll to="/admin/accessories" label="Accessories" />} />
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.inventory.low} of {data.inventory.total} accessories at or below their alert level
                  </p>
                  {data.inventory.total === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">
                      No accessories yet.{" "}
                      <Link to="/admin/accessories/new" className="text-[hsl(var(--admin-accent))] hover:underline">Add your materials</Link>{" "}
                      to track stock.
                    </p>
                  ) : data.inventory.items.length === 0 ? (
                    <EmptyLine>Everything is well stocked</EmptyLine>
                  ) : (
                    <ul className="mt-2 divide-y divide-zinc-100 text-sm">
                      {data.inventory.items.map((a) => {
                        const negative = toNumber(a.stock) < 0;
                        return (
                          <li key={a.id}>
                            <Link to={`/admin/accessories/${a.id}/edit`} className="flex items-center gap-2 py-2 hover:text-[hsl(var(--admin-accent))]">
                              <span className="flex-1 truncate">{a.name}</span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                                  negative ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900",
                                )}
                              >
                                {formatQty(a.stock)} {a.unit}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              )}

              {(data.catalogue || sales) && (
                <Card>
                  <CardHeader title="Catalogue & customers" />
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    {data.catalogue && (
                      <>
                        <Stat icon={Package} label="Products" value={data.catalogue.products} to="/admin/products" />
                        <Stat label="Categories" value={data.catalogue.categories} to="/admin/categories" />
                        <Stat label="Featured" value={data.catalogue.featured} />
                      </>
                    )}
                    {sales && (
                      <Stat
                        icon={Users}
                        label="Customers"
                        value={sales.customers.total}
                        hint={data.start ? `${sales.customers.new} new` : undefined}
                      />
                    )}
                  </div>
                  {data.catalogue && data.catalogue.unmapped > 0 && (
                    <Link
                      to="/admin/products"
                      className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 hover:bg-amber-100"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        {data.catalogue.unmapped} of {data.catalogue.products} products have no accessories mapped, so their
                        orders won't reduce stock.
                      </span>
                    </Link>
                  )}
                </Card>
              )}
            </div>

            {sales && (
              <Card>
                <CardHeader title="Recent orders" action={<ViewAll to="/admin/orders" />} />
                {sales.recent.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">No orders yet.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Invoice #</th>
                          <th className="py-2 pr-3 font-medium">Client</th>
                          <th className="py-2 pr-3 font-medium">Date</th>
                          <th className="py-2 pr-3 text-right font-medium">Total</th>
                          <th className="py-2 pr-3 text-right font-medium">Received</th>
                          <th className="py-2 font-medium">Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.recent.map((o) => (
                          <tr key={o.id} className="border-t border-zinc-100">
                            <td className="py-2 pr-3 font-medium">
                              <Link to={`/admin/orders/${o.id}`} className="hover:underline">{o.invoice_number}</Link>
                              {o.source === "storefront" && (
                                <Globe className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground" aria-label="Website order" />
                              )}
                            </td>
                            <td className="py-2 pr-3">{o.customer_name}</td>
                            <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">{formatDate(o.order_date)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{formatRupees(o.total)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{formatRupees(o.paid)}</td>
                            <td className="py-2"><StageBadge stage={o.stage} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  to,
}: {
  icon?: typeof Package;
  label: string;
  value: number;
  hint?: string;
  to?: string;
}) {
  const inner = (
    <>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">
        {value}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>}
      </p>
    </>
  );
  return to ? (
    <Link to={to} className="rounded-xl bg-zinc-50 p-3 hover:bg-zinc-100">{inner}</Link>
  ) : (
    <div className="rounded-xl bg-zinc-50 p-3">{inner}</div>
  );
}
