import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { ShortageDialog, shortagesFromError } from "@/components/shortage-dialog";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/site-data";
import { ApiError, api } from "@/lib/api";
import { type Requirement, formatQty, toNumber } from "@/lib/inventory";
import { cn } from "@/lib/utils";

type SearchResult = Product & { accessory_count: number };

interface Line {
  handle: string;
  title: string;
  image: string;
  listPrice: number;
  accessoryCount: number;
  quantity: string;
  price: string;
}

const inputClass = (invalid?: boolean) =>
  cn(
    "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
    invalid
      ? "border-destructive focus:ring-destructive"
      : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
  );

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
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
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

  const requirementKey = lines.map((l) => `${l.handle}:${l.quantity}`).join(",");
  useEffect(() => {
    const items = lines
      .map((l) => ({ handle: l.handle, quantity: Math.floor(Number(l.quantity)) }))
      .filter((l) => l.quantity >= 1);
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
    setLines((prev) => {
      const existing = prev.find((l) => l.handle === p.handle);
      if (existing) {
        return prev.map((l) =>
          l.handle === p.handle ? { ...l, quantity: String(Math.floor(Number(l.quantity) || 0) + 1) } : l,
        );
      }
      return [
        ...prev,
        {
          handle: p.handle,
          title: p.title,
          image: p.image,
          listPrice: p.price,
          accessoryCount: p.accessory_count,
          quantity: "1",
          price: String(p.price),
        },
      ];
    });
    setQuery("");
    setResults([]);
    setSearchOpen(false);
    setError(null);
  };

  const updateLine = (handle: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.handle === handle ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce(
    (sum, l) => sum + Math.max(0, Math.floor(Number(l.quantity) || 0)) * Math.max(0, Number(l.price) || 0),
    0,
  );
  const unmapped = lines.filter((l) => l.accessoryCount === 0);
  const hasShortage = requirements.some((r) => toNumber(r.shortage) > 0);

  const submit = async (allowShortage: boolean) => {
    setError(null);
    if (!customerName.trim()) {
      setNameError(true);
      setError("Enter the customer's name");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one product");
      return;
    }
    const bad = lines.find(
      (l) =>
        !Number.isInteger(Number(l.quantity)) ||
        Number(l.quantity) < 1 ||
        l.price === "" ||
        Number.isNaN(Number(l.price)) ||
        Number(l.price) < 0,
    );
    if (bad) {
      setError(`Check the quantity and price for "${bad.title}"`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ id: number }>("/admin/orders", {
        customer_name: customerName.trim(),
        customer_phone: phone,
        customer_email: email,
        shipping_address: address,
        notes,
        status: confirmNow ? "confirmed" : "pending",
        allow_shortage: allowShortage,
        items: lines.map((l) => ({
          handle: l.handle,
          quantity: Number(l.quantity),
          unit_price: Math.round(Number(l.price)),
        })),
      });
      toast.success(`Order #${res.id} created`);
      navigate(`/admin/orders/${res.id}`);
    } catch (err) {
      const found = shortagesFromError(err);
      if (found) {
        setShortages(found);
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold">New Order</h1>

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

          <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Products</h2>
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
                    }
                  }}
                  placeholder="Search products to add..."
                  aria-label="Search products to add"
                  className="ml-2 w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
              {searchOpen && results.length > 0 && (
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
                </ul>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Product</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3">Price (₹)</th>
                      <th className="py-2 pr-3 text-right">Total</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.handle} className="border-t border-zinc-100">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-3">
                            <img src={l.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{l.title}</p>
                              {Number(l.price) !== l.listPrice && (
                                <p className="text-xs text-muted-foreground">List price ₹{l.listPrice}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            aria-label={`Quantity of ${l.title}`}
                            value={l.quantity}
                            onChange={(e) => updateLine(l.handle, { quantity: e.target.value })}
                            className="w-20 rounded-xl border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            aria-label={`Price of ${l.title}`}
                            value={l.price}
                            onChange={(e) => updateLine(l.handle, { price: e.target.value })}
                            className="w-24 rounded-xl border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
                          />
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          ₹{Math.max(0, Math.floor(Number(l.quantity) || 0)) * Math.max(0, Number(l.price) || 0)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setLines((prev) => prev.filter((x) => x.handle !== l.handle))}
                            aria-label={`Remove ${l.title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200 font-semibold">
                      <td colSpan={3} className="py-2 pr-3 text-right">Subtotal</td>
                      <td className="py-2 pr-3 text-right tabular-nums">₹{subtotal}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">Customer</h2>
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
              <input
                id="customer-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="customer-email" className="text-sm font-medium">
                Email or Instagram handle <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="customer-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="customer-address" className="text-sm font-medium">
                Delivery address <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="customer-address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass()}
              />
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
                placeholder="Colours, customisation, delivery date..."
                className={inputClass()}
              />
            </div>
          </section>
        </div>

        <aside className="flex w-full flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm max-w-3xl xl:sticky xl:top-0 xl:max-w-sm">
          <h2 className="font-semibold">Accessories needed</h2>
          {requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {lines.length === 0
                ? "Add products to see which accessories this order uses."
                : "These products have no accessories mapped."}
            </p>
          ) : (
            <RequirementsTable requirements={requirements} />
          )}
          {unmapped.length > 0 && lines.length > 0 && (
            <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No accessories mapped for {unmapped.map((l) => l.title).join(", ")}, so they won't
              reduce stock.
            </p>
          )}

          <fieldset className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
            <legend className="sr-only">Order status</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="status"
                checked={confirmNow}
                onChange={() => setConfirmNow(true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Confirm now</span>
                <span className="block text-xs text-muted-foreground">Deducts accessories from stock.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="status"
                checked={!confirmNow}
                onChange={() => setConfirmNow(false)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Save as pending</span>
                <span className="block text-xs text-muted-foreground">Stock is deducted when you confirm it later.</span>
              </span>
            </label>
          </fieldset>

          {confirmNow && hasShortage && (
            <p className="text-xs text-destructive">Some accessories are short. You'll be asked to confirm.</p>
          )}

          <Button type="submit" variant="accent" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : confirmNow ? "Create & confirm order" : "Save pending order"}
          </Button>
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
