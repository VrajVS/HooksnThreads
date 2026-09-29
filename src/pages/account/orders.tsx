import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckCircle2, Package } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { INSTAGRAM_URL } from "@/data/site-data";
import { ApiError, api } from "@/lib/api";
import { type OrderItem, type OrderStatus, formatDateTime } from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface CustomerOrder {
  id: number;
  status: OrderStatus;
  shipping_address: string | null;
  notes: string | null;
  subtotal: number;
  created_at: string;
  items: OrderItem[];
}

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Awaiting confirmation", className: "bg-amber-100 text-amber-900" },
  confirmed: { label: "Confirmed — being made", className: "bg-emerald-100 text-emerald-900" },
  completed: { label: "Completed", className: "bg-sky-100 text-sky-900" },
  cancelled: { label: "Cancelled", className: "bg-zinc-100 text-zinc-500" },
};

export function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const placedId = (location.state as { placed?: number } | null)?.placed;
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<CustomerOrder[]>("/orders")
      .then(setOrders)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load your orders"));
  }, [user]);

  if (!authLoading && !user) return <Navigate to="/login?next=/account/orders" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-12 md:py-16">
        <p className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Account</Link> / Orders
        </p>
        <h1 className="display mt-1 text-4xl md:text-5xl">My <em>Orders</em></h1>

        {placedId && (
          <div className="mt-6 flex max-w-3xl gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>
              Thank you! Order #{placedId} is in. We'll review it and reach out to confirm the details
              and payment. You can also message us on{" "}
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Instagram
              </a>
              .
            </p>
          </div>
        )}

        <div className="mt-8 flex max-w-3xl flex-col gap-4">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : orders === null ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-3xl" />)
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-3xl bg-white p-8 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
              <Package className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-muted-foreground">You haven't placed any orders yet.</p>
              <Button asChild>
                <Link to="/products">Browse pieces</Link>
              </Button>
            </div>
          ) : (
            orders.map((order) => (
              <article
                key={order.id}
                className={cn(
                  "rounded-3xl bg-white p-6 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]",
                  order.id === placedId && "ring-2 ring-emerald-300",
                )}
              >
                <header className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold">Order #{order.id}</h2>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS[order.status].className)}>
                    {STATUS[order.status].label}
                  </span>
                  <span className="ml-auto text-sm text-muted-foreground">{formatDateTime(order.created_at)}</span>
                </header>
                <ul className="mt-4 flex flex-col gap-3">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 text-sm">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-secondary" />
                      )}
                      <span className="flex-1">
                        {item.handle ? (
                          <Link to={`/product/${item.handle}`} className="hover:underline">{item.title}</Link>
                        ) : (
                          item.title
                        )}
                        <span className="block text-muted-foreground">
                          {item.quantity} × ₹{item.unit_price}
                        </span>
                      </span>
                      <span className="tabular-nums">₹{item.unit_price * item.quantity}</span>
                    </li>
                  ))}
                </ul>
                <footer className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4 text-sm">
                  {order.shipping_address && (
                    <p className="max-w-md text-muted-foreground">Deliver to: {order.shipping_address}</p>
                  )}
                  <p className="ml-auto font-semibold">Total ₹{order.subtotal}</p>
                </footer>
              </article>
            ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
