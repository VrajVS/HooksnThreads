import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/context/admin-auth-context";
import { ApiError, api } from "@/lib/api";
import { type BusinessSettings, PAYMENT_MODE_LABELS, formatDate, paymentModeLabel } from "@/lib/inventory";
import { rupeesInWords } from "@/lib/rupees-in-words";
import type { OrderDetail } from "@/pages/admin/order-detail";

// Brand colours from the logo: navy ink and the sage stitch accent.
const INK = "#28305b";
const SAGE = "#8aa493";
const INK_TINT = "#eef0f6";

const INSTAGRAM_HANDLE = "@hooksnthreads_official";

function rupees(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paymentStatus(order: OrderDetail): { label: string; color: string; background: string } {
  if (order.status === "cancelled") return { label: "Cancelled", color: "#52525b", background: "#f4f4f5" };
  if (order.total > 0 && order.balance <= 0) return { label: "Paid", color: "#166534", background: "#dcfce7" };
  if (order.paid > 0) return { label: "Partially paid", color: "#9a3412", background: "#ffedd5" };
  return { label: "Payment due", color: "#9f1239", background: "#ffe4e6" };
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: SAGE }}>
      {children}
    </p>
  );
}

export function AdminOrderInvoicePage() {
  const { id } = useParams();
  const location = useLocation();
  const { admin, loading } = useAdminAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    Promise.all([api.get<OrderDetail>(`/admin/orders/${id}`), api.get<BusinessSettings>("/admin/orders/settings")])
      .then(([o, s]) => {
        setOrder(o);
        setSettings(s);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load invoice"));
  }, [admin, id]);

  // The browser uses the page title as the default PDF file name.
  useEffect(() => {
    if (!order) return;
    const previous = document.title;
    const client = order.customer_name.trim().split(/\s+/)[0] || "client";
    document.title = `invoice_${order.invoice_number}_${client}`;
    return () => {
      document.title = previous;
    };
  }, [order]);

  if (!loading && !admin) return <Navigate to="/admin/login" state={{ from: location }} replace />;

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error}</p>
        <Link to={`/admin/orders/${id}`} className="mt-3 inline-block text-sm hover:underline">Back to order</Link>
      </div>
    );
  }

  if (!order || !settings) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-muted-foreground">Loading invoice...</div>;
  }

  const status = paymentStatus(order);
  const paymentMode = paymentModeLabel(order.payment_mode, order.payments);
  const contactLine = [settings.phone, settings.email, INSTAGRAM_HANDLE].filter(Boolean).join("  ·  ");

  return (
    <div className="min-h-screen bg-zinc-100 print:bg-white">
      <style>{`@page { size: A4; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="mx-auto flex max-w-[210mm] items-center gap-3 px-4 py-4 print:hidden">
        <Link
          to={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to order
        </Link>
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
          Choose "Save as PDF" in the print dialog to download.
        </p>
        <Button variant="accent" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>

      <article
        className="relative mx-auto mb-10 flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white text-[12.5px] leading-relaxed text-zinc-800 shadow-sm print:mb-0 print:min-h-[297mm] print:shadow-none"
        style={{ fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}
      >
        <div className="h-2 w-full" style={{ backgroundColor: INK }} />

        <div className="flex flex-1 flex-col px-[16mm] pb-[12mm] pt-[12mm]">
          {/* Header */}
          <header className="flex items-start justify-between gap-8">
            <img src="/images/logo-invoice.png" alt={settings.business_name} className="h-[26mm] w-auto object-contain" />
            <div className="text-right">
              <h1 className="font-brand text-[30px] font-semibold tracking-[0.25em]" style={{ color: INK }}>
                INVOICE
              </h1>
              <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-6 gap-y-1 text-[12px]">
                <dt className="text-zinc-500">Invoice no.</dt>
                <dd className="font-semibold tabular-nums" style={{ color: INK }}>{order.invoice_number}</dd>
                <dt className="text-zinc-500">Invoice date</dt>
                <dd className="font-medium tabular-nums">{formatDate(order.order_date)}</dd>
                {order.delivery_date && (
                  <>
                    <dt className="text-zinc-500">{order.delivered ? "Delivered on" : "Delivery by"}</dt>
                    <dd className="font-medium tabular-nums">{formatDate(order.delivery_date)}</dd>
                  </>
                )}
                {paymentMode && (
                  <>
                    <dt className="text-zinc-500">Payment mode</dt>
                    <dd className="font-medium">{paymentMode}</dd>
                  </>
                )}
              </dl>
              <span
                className="mt-3 inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: status.color, backgroundColor: status.background }}
              >
                {status.label}
              </span>
            </div>
          </header>

          {/* Parties */}
          <section className="mt-10 grid grid-cols-2 gap-10 border-t pt-6" style={{ borderColor: "#e4e4e7" }}>
            <div>
              <Label>From</Label>
              <p className="mt-2 text-[14px] font-semibold" style={{ color: INK }}>{settings.business_name}</p>
              {settings.contact_name && <p>{settings.contact_name}</p>}
              {settings.phone && <p className="tabular-nums">{settings.phone}</p>}
              {settings.email && <p>{settings.email}</p>}
              {settings.address && <p className="whitespace-pre-line text-zinc-600">{settings.address}</p>}
            </div>
            <div className="text-right">
              <Label>Billed to</Label>
              <p className="mt-2 text-[14px] font-semibold" style={{ color: INK }}>{order.customer_name}</p>
              {order.customer_phone && <p className="tabular-nums">{order.customer_phone}</p>}
              {order.customer_email && <p>{order.customer_email}</p>}
              {order.shipping_address && <p className="whitespace-pre-line text-zinc-600">{order.shipping_address}</p>}
            </div>
          </section>

          {/* Items */}
          <table className="mt-10 w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: INK_TINT, color: INK }} className="text-[10.5px] font-semibold uppercase tracking-[0.12em]">
                <th className="w-10 rounded-l-[4px] px-3 py-2.5 text-left">#</th>
                <th className="px-3 py-2.5 text-left">Description</th>
                <th className="w-16 px-3 py-2.5 text-right">Qty</th>
                <th className="w-28 px-3 py-2.5 text-right">Rate</th>
                <th className="w-32 rounded-r-[4px] px-3 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={item.id} className="border-b" style={{ borderColor: "#ececf0" }}>
                  <td className="px-3 py-3 align-top tabular-nums text-zinc-400">{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-3 align-top font-medium text-zinc-900">{item.title}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums">{rupees(item.unit_price)}</td>
                  <td className="px-3 py-3 text-right align-top font-medium tabular-nums text-zinc-900">
                    {rupees(item.unit_price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Words + totals */}
          <section className="mt-6 flex items-start justify-between gap-10">
            <div className="max-w-[88mm] pt-1">
              <Label>Amount in words</Label>
              <p className="mt-1.5 font-medium italic text-zinc-900">Rupees {rupeesInWords(order.total).toLowerCase()}</p>

              {order.payments.length > 0 && (
                <div className="mt-6">
                  <Label>Payments received</Label>
                  <table className="mt-1.5 text-[11.5px]">
                    <tbody>
                      {order.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-0.5 pr-4 tabular-nums text-zinc-500">{formatDate(p.paid_on)}</td>
                          <td className="py-0.5 pr-4">{PAYMENT_MODE_LABELS[p.mode]}</td>
                          <td className="py-0.5 text-right tabular-nums">{rupees(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <dl className="w-[74mm] shrink-0 text-[12.5px]">
              <div className="flex justify-between px-3 py-1.5">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="tabular-nums">{rupees(order.subtotal)}</dd>
              </div>
              {order.charges.map((c) => (
                <div key={c.id} className="flex justify-between px-3 py-1.5">
                  <dt className="text-zinc-500">{c.label}</dt>
                  <dd className="tabular-nums">{c.amount < 0 ? `− ${rupees(Math.abs(c.amount))}` : rupees(c.amount)}</dd>
                </div>
              ))}
              <div
                className="mt-2 flex items-baseline justify-between rounded-[4px] px-3 py-2.5 text-white"
                style={{ backgroundColor: INK }}
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.15em]">Total</dt>
                <dd className="text-[16px] font-semibold tabular-nums">{rupees(order.total)}</dd>
              </div>
              {order.paid > 0 && (
                <>
                  <div className="mt-1 flex justify-between px-3 py-1.5">
                    <dt className="text-zinc-500">Amount received</dt>
                    <dd className="tabular-nums">− {rupees(order.paid)}</dd>
                  </div>
                  <div className="flex justify-between border-t px-3 py-2 font-semibold" style={{ borderColor: "#e4e4e7", color: INK }}>
                    <dt>{order.balance < 0 ? "Overpaid" : "Balance due"}</dt>
                    <dd className="tabular-nums">{rupees(Math.abs(order.balance))}</dd>
                  </div>
                </>
              )}
            </dl>
          </section>

          {/* Footer */}
          <footer className="mt-auto pt-12 text-center">
            <p className="font-brand text-[15px] tracking-[0.12em]" style={{ color: INK }}>
              Thank you for choosing handmade
            </p>
            <div className="mx-auto mt-3 h-px w-16" style={{ backgroundColor: SAGE }} />
            {settings.invoice_footer && <p className="mt-3 text-[11px] italic text-zinc-500">{settings.invoice_footer}</p>}
            <p className="mt-1 text-[11px] text-zinc-500">{contactLine}</p>
          </footer>
        </div>

        <div className="h-1 w-full" style={{ backgroundColor: SAGE }} />
      </article>
    </div>
  );
}
