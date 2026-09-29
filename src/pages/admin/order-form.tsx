import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, PenLine, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { ShortageDialog, shortagesFromError } from "@/components/shortage-dialog";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/site-data";
import { ApiError, api } from "@/lib/api";
import {
  ORDER_PAYMENT_MODES,
  type OrderCharge,
  type OrderItem,
  type OrderPaymentMode,
  type Requirement,
  formatQty,
  formatRupees,
  todayIso,
  toNumber,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

type SearchResult = Product & { accessory_count: number };

interface Line {
  key: number;
  handle: string | null;
  title: string;
  image: string | null;
  listPrice: number | null;
  accessoryCount: number | null;
  quantity: string;
  price: string;
}

interface ChargeLine {
  key: number;
  label: string;
  amount: string;
}

interface EditableOrder {
  invoice_number: string;
  order_date: string;
  status: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_address: string | null;
  notes: string | null;
  items: OrderItem[];
  charges: OrderCharge[];
  payment_mode: OrderPaymentMode | null;
}

const CHARGE_PRESETS: { label: string; sign: 1 | -1 }[] = [
  { label: "Wrapping", sign: 1 },
  { label: "Courier", sign: 1 },
  { label: "Shipping", sign: 1 },
  { label: "Discount", sign: -1 },
];

let nextKey = 0;
const key = () => ++nextKey;

const inputClass = (invalid?: boolean) =>
  cn(
    "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
    invalid
      ? "border-destructive focus:ring-destructive"
      : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
  );

const cellInput =
  "rounded-xl border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]";

const qtyOf = (l: Line) => Math.max(0, Math.floor(Number(l.quantity) || 0));
const priceOf = (l: Line) => Math.max(0, Math.round(Number(l.price) || 0));
const chargeOf = (c: ChargeLine) => Math.round(Number(c.amount) || 0);

export function RequirementsTable({ requirements }: { requirements: Requirement[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase text-muted-foreground">
        <tr>
          <th className="py-1.5 pr-2">Accessory</th>
          <th className="py-1.5 pr-2 text-right">Needed</th>
          <th className="py-1.5 text-right">In stock</th>
        </tr>
      </thead>
      <tbody>
        {requirements.map((r) => {
          const short = toNumber(r.shortage) > 0;
          return (
            <tr key={r.accessory_id} className="border-t border-zinc-100">
              <td className="py-1.5 pr-2">{r.name}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatQty(r.required)} {r.unit}
              </td>
              <td className={cn("py-1.5 text-right tabular-nums", short && "font-medium text-destructive")}>
                {formatQty(r.stock)} {r.unit}
                {short && <span className="block text-xs">short {formatQty(r.shortage)}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function AdminOrderFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState(!isEdit);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceTouched, setInvoiceTouched] = useState(false);
  const [orderDate, setOrderDate] = useState(todayIso());
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [charges, setCharges] = useState<ChargeLine[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"online" | "cash">("online");
  const [orderPaymentMode, setOrderPaymentMode] = useState<OrderPaymentMode | "">("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [shortages, setShortages] = useState<Requirement[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get<EditableOrder>(`/admin/orders/${id}`)
      .then((o) => {
        setInvoiceNumber(o.invoice_number);
        setInvoiceTouched(true);
        setOrderDate(o.order_date);
        setCustomerName(o.customer_name);
        setPhone(o.customer_phone ?? "");
        setEmail(o.customer_email ?? "");
        setAddress(o.shipping_address ?? "");
        setNotes(o.notes ?? "");
        setOrderPaymentMode(o.payment_mode ?? "");
        setLines(
          o.items.map((i) => ({
            key: key(),
            handle: i.handle,
            title: i.title,
            image: i.image,
            listPrice: null,
            accessoryCount: null,
            quantity: String(i.quantity),
            price: String(i.unit_price),
          })),
        );
        setCharges(o.charges.map((c) => ({ key: key(), label: c.label, amount: String(c.amount) })));
        setLoaded(true);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load order");
        setLoaded(true);
      });
  }, [id, isEdit]);

  // Suggest the next YYYYMMNN number for the chosen date until the user types their own.
  useEffect(() => {
    if (isEdit || invoiceTouched || !orderDate) return;
    api
      .get<{ invoice_number: string }>(`/admin/orders/next-invoice-number?on=${orderDate}`)
      .then((r) => setInvoiceNumber(r.invoice_number))
      .catch(() => {});
  }, [orderDate, invoiceTouched, isEdit]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ page: "1", page_size: "8", search: term });
      api
        .get<{ items: SearchResult[] }>(`/admin/products?${params}`)
        .then((res) => setResults(res.items))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const requirementKey = lines.filter((l) => l.handle).map((l) => `${l.handle}:${l.quantity}`).join(",");
  useEffect(() => {
    const items = lines
      .filter((l) => l.handle && qtyOf(l) >= 1)
      .map((l) => ({ handle: l.handle, quantity: qtyOf(l) }));
    if (items.length === 0) {
      setRequirements([]);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .post<Requirement[]>("/admin/orders/requirements", { items })
        .then(setRequirements)
        .catch(() => setRequirements([]));
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirementKey]);

  const addProduct = (p: SearchResult) => {
    setLines((prev) => [
      ...prev,
      {
        key: key(),
        handle: p.handle,
        title: p.title,
        image: p.image,
        listPrice: p.price,
        accessoryCount: p.accessory_count,
        quantity: "1",
        price: String(p.price),
      },
    ]);
    setQuery("");
    setResults([]);
    setSearchOpen(false);
    setError(null);
  };

  const addCustom = () => {
    setLines((prev) => [
      ...prev,
      { key: key(), handle: null, title: query.trim(), image: null, listPrice: null, accessoryCount: null, quantity: "1", price: "" },
    ]);
    setQuery("");
    setSearchOpen(false);
    setError(null);
  };

  const updateLine = (k: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const updateCharge = (k: number, patch: Partial<ChargeLine>) =>
    setCharges((prev) => prev.map((c) => (c.key === k ? { ...c, ...patch } : c)));

  const subtotal = lines.reduce((sum, l) => sum + qtyOf(l) * priceOf(l), 0);
  const chargesTotal = charges.reduce((sum, c) => sum + chargeOf(c), 0);
  const total = subtotal + chargesTotal;
  const unmapped = lines.filter((l) => l.handle && l.accessoryCount === 0);
  const hasShortage = requirements.some((r) => toNumber(r.shortage) > 0);

  const submit = async (allowShortage: boolean) => {
    setError(null);
    if (!customerName.trim()) {
      setNameError(true);
      setError("Enter the client's name");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one item");
      return;
    }
    const bad = lines.find(
      (l) =>
        !l.title.trim() ||
        !Number.isInteger(Number(l.quantity)) ||
        Number(l.quantity) < 1 ||
        l.price === "" ||
        Number.isNaN(Number(l.price)) ||
        Number(l.price) < 0,
    );
    if (bad) {
      setError(bad.title.trim() ? `Check the quantity and price for "${bad.title}"` : "Every item needs a description");
      return;
    }
    const badCharge = charges.find((c) => c.amount !== "" && Number.isNaN(Number(c.amount)));
    if (badCharge) {
      setError(`Check the amount for "${badCharge.label || "extra charge"}"`);
      return;
    }
    if (total < 0) {
      setError("The order total can't be negative");
      return;
    }
    const payment = Math.round(Number(paymentAmount) || 0);

    const body = {
      invoice_number: invoiceNumber.trim() || null,
      order_date: orderDate,
      customer_name: customerName.trim(),
      customer_phone: phone,
      customer_email: email,
      shipping_address: address,
      notes,
      payment_mode: orderPaymentMode || null,
      allow_shortage: allowShortage,
      items: lines.map((l) => ({
        handle: l.handle,
        title: l.title.trim(),
        quantity: qtyOf(l),
        unit_price: priceOf(l),
      })),
      charges: charges
        .filter((c) => c.label.trim() && chargeOf(c) !== 0)
        .map((c) => ({ label: c.label.trim(), amount: chargeOf(c) })),
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/admin/orders/${id}`, body);
        toast.success(`Invoice #${invoiceNumber} updated`);
        navigate(`/admin/orders/${id}`);
      } else {
        const res = await api.post<{ id: number }>("/admin/orders", {
          ...body,
          status: confirmNow ? "confirmed" : "pending",
          payment: payment > 0 ? { amount: payment, mode: paymentMode } : null,
        });
        toast.success("Order created");
        navigate(`/admin/orders/${res.id}`);
      }
    } catch (err) {
      const found = shortagesFromError(err);
      if (found) setShortages(found);
      else setError(err instanceof ApiError ? err.message : "Something went wrong");
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
      <h1 className="text-2xl font-semibold">{isEdit ? `Edit Order ${invoiceNumber}` : "New Order"}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        noValidate
        className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start"
      >
        <div className="flex w-full min-w-0 max-w-3xl flex-col gap-6">
          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
          )}

          <section className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invoice-number" className="text-sm font-medium">Invoice #</label>
              <input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setInvoiceTouched(true);
                }}
                className={cn(inputClass(), "tabular-nums")}
              />
              {!isEdit && !invoiceTouched && (
                <p className="text-xs text-muted-foreground">Next number for this month. You can change it.</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="order-date" className="text-sm font-medium">Order date</label>
              <input
                id="order-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className={inputClass()}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Items</h2>
            <div ref={searchBoxRef} className="relative">
              <div className="flex items-center rounded-xl border border-zinc-200 px-4 py-2.5 focus-within:ring-1 focus-within:ring-[hsl(var(--admin-accent))]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (results[0]) addProduct(results[0]);
                      else if (query.trim()) addCustom();
                    }
                  }}
                  placeholder="Search the catalogue, or type a custom item..."
                  aria-label="Add item"
                  className="ml-2 w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
              {searchOpen && query.trim() && (
                <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
                  {results.map((p) => (
                    <li key={p.handle}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100"
                      >
                        <img src={p.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                        <span className="flex-1 truncate">{p.title}</span>
                        <span className="text-xs text-muted-foreground">{p.category}</span>
                        <span className="tabular-nums">₹{p.price}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={addCustom}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
                        <PenLine className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">
                        Add custom item "<span className="font-medium">{query.trim()}</span>"
                      </span>
                    </button>
                  </li>
                </ul>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items yet. Pick from the catalogue so accessories are tracked, or add a custom
                piece (e.g. a sweater or a special order).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3">Price (₹)</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.key} className="border-t border-zinc-100 align-top">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-3">
                            {l.image ? (
                              <img src={l.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                                <PenLine className="h-4 w-4" />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <input
                                aria-label="Item description"
                                value={l.title}
                                onChange={(e) => updateLine(l.key, { title: e.target.value })}
                                placeholder="e.g. Tote bag (pink)"
                                className={cn(cellInput, "w-full min-w-[12rem]")}
                              />
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {l.handle ? "Catalogue item" : "Custom item, no stock tracking"}
                                {l.listPrice !== null && priceOf(l) !== l.listPrice && ` · list price ₹${l.listPrice}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            aria-label={`Quantity of ${l.title || "item"}`}
                            value={l.quantity}
                            onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                            className={cn(cellInput, "w-20")}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            aria-label={`Price of ${l.title || "item"}`}
                            value={l.price}
                            onChange={(e) => updateLine(l.key, { price: e.target.value })}
                            placeholder="0"
                            className={cn(cellInput, "w-24")}
                          />
                        </td>
                        <td className="py-3.5 pr-3 text-right tabular-nums">{formatRupees(qtyOf(l) * priceOf(l))}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                            aria-label={`Remove ${l.title || "item"}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-semibold">Extra charges &amp; discounts</h2>
              {CHARGE_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCharges((prev) => [...prev, { key: key(), label: p.label, amount: p.sign < 0 ? "-" : "" }])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {p.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCharges((prev) => [...prev, { key: key(), label: "", amount: "" }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Other
              </Button>
            </div>
            {charges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Wrapping, courier, cashback... Use a negative amount for a discount.
              </p>
            ) : (
              charges.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <input
                    aria-label="Charge description"
                    value={c.label}
                    onChange={(e) => updateCharge(c.key, { label: e.target.value })}
                    placeholder="Description"
                    className={cn(cellInput, "min-w-0 flex-1")}
                  />
                  <input
                    aria-label={`Amount for ${c.label || "charge"}`}
                    type="text"
                    inputMode="numeric"
                    value={c.amount}
                    onChange={(e) => updateCharge(c.key, { amount: e.target.value })}
                    placeholder="₹"
                    className={cn(cellInput, "w-28 text-right tabular-nums")}
                  />
                  <button
                    type="button"
                    onClick={() => setCharges((prev) => prev.filter((x) => x.key !== c.key))}
                    aria-label={`Remove ${c.label || "charge"}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
            <dl className="mt-2 flex flex-col gap-1 border-t border-zinc-100 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items</dt>
                <dd className="tabular-nums">{formatRupees(subtotal)}</dd>
              </div>
              {chargesTotal !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Extras</dt>
                  <dd className="tabular-nums">{chargesTotal > 0 ? "+" : "−"}{formatRupees(Math.abs(chargesTotal))}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className={cn("tabular-nums", total < 0 && "text-destructive")}>{formatRupees(total)}</dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">Client</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customer-name" className="text-sm font-medium">Name</label>
              <input
                id="customer-name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setNameError(false);
                }}
                className={inputClass(nameError)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customer-phone" className="text-sm font-medium">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input id="customer-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass()} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="customer-email" className="text-sm font-medium">
                Email or Instagram handle <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input id="customer-email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="customer-address" className="text-sm font-medium">
                Delivery address <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea id="customer-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass()} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="order-notes" className="text-sm font-medium">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="order-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Colours, customisation, B2B order, gift..."
                className={inputClass()}
              />
            </div>
          </section>
        </div>

        <aside className="flex w-full max-w-3xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm xl:sticky xl:top-0 xl:max-w-sm">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="payment-mode" className="font-semibold">Mode of payment</label>
            <select
              id="payment-mode"
              value={orderPaymentMode}
              onChange={(e) => {
                const mode = e.target.value as OrderPaymentMode | "";
                setOrderPaymentMode(mode);
                if (mode === "online" || mode === "cash") setPaymentMode(mode);
              }}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
            >
              <option value="">Not decided yet</option>
              {ORDER_PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Printed on the invoice.</p>
          </div>

          {!isEdit && (
            <fieldset className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
              <legend className="mb-2 font-semibold">Amount received</legend>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Amount received"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="₹0"
                  className={cn(cellInput, "min-w-0 flex-1 py-2")}
                />
                <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1">
                  {(["online", "cash"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMode(m)}
                      aria-pressed={paymentMode === m}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium capitalize",
                        paymentMode === m ? "bg-white shadow-sm" : "text-zinc-500",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Advance or full payment. Add more payments later from the order page.
              </p>
            </fieldset>
          )}

          <div className="border-t border-zinc-100 pt-4">
            <h2 className="font-semibold">Accessories needed</h2>
            <div className="mt-2">
              {requirements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lines.some((l) => l.handle)
                    ? "These catalogue items have no accessories mapped."
                    : "Only catalogue items use accessory stock."}
                </p>
              ) : (
                <RequirementsTable requirements={requirements} />
              )}
            </div>
            {unmapped.length > 0 && (
              <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No accessories mapped for {unmapped.map((l) => l.title).join(", ")}, so they won't
                reduce stock.
              </p>
            )}
          </div>

          {!isEdit && (
            <fieldset className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
              <legend className="sr-only">Order status</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="status" checked={confirmNow} onChange={() => setConfirmNow(true)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Confirm now</span>
                  <span className="block text-xs text-muted-foreground">Deducts accessories from stock.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="status" checked={!confirmNow} onChange={() => setConfirmNow(false)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Save as pending</span>
                  <span className="block text-xs text-muted-foreground">Stock is deducted when you confirm it later.</span>
                </span>
              </label>
            </fieldset>
          )}

          {(confirmNow || isEdit) && hasShortage && (
            <p className="text-xs text-destructive">Some accessories are short. You'll be asked to confirm.</p>
          )}

          <Button type="submit" variant="accent" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : isEdit ? "Save changes" : confirmNow ? "Create & confirm order" : "Save pending order"}
          </Button>
          {isEdit && (
            <Button type="button" variant="outline" onClick={() => navigate(`/admin/orders/${id}`)}>
              Cancel
            </Button>
          )}
        </aside>
      </form>

      <ShortageDialog
        shortages={shortages}
        onCancel={() => setShortages(null)}
        onProceed={() => {
          setShortages(null);
          submit(true);
        }}
      />
    </AdminLayout>
  );
}
