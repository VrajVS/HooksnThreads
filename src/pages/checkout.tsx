import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MapPin, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/gradient-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useAddresses } from "@/hooks/use-addresses";
import { INSTAGRAM_URL } from "@/data/site-data";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-12 md:py-16">
        <h1 className="display text-4xl md:text-5xl">Checkout</h1>

        {items.length === 0 ? (
          <div className="mt-8 flex max-w-xl flex-col items-start gap-4 rounded-3xl bg-white p-8 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Button asChild>
              <Link to="/products">Browse pieces</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
            <div>
              {authLoading ? (
                <Skeleton className="h-48 w-full rounded-3xl" />
              ) : user ? (
                <PlaceOrderForm onPlaced={clearCart} />
              ) : (
                <div className="flex flex-col items-start gap-4 rounded-3xl bg-white p-8 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
                  <h2 className="text-xl font-semibold">Log in to place your order</h2>
                  <p className="text-muted-foreground">
                    We'll use your saved address and send order updates to your account.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to="/login?next=/checkout">Log in</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/signup?next=/checkout">Create account</Link>
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Prefer chatting?{" "}
                    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      Send us your cart on Instagram
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>

            <aside className="rounded-3xl bg-white p-6 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
              <h2 className="font-semibold">Order summary</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item.handle} className="flex items-center gap-3 text-sm">
                    <img src={item.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    <span className="flex-1">
                      {item.title}
                      <span className="block text-muted-foreground">Qty {item.quantity}</span>
                    </span>
                    <span className="tabular-nums">₹{item.price * item.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold">
                <span>Subtotal</span>
                <span className="tabular-nums">₹{subtotal}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Shipping, if any, is confirmed with your order.
              </p>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function PlaceOrderForm({ onPlaced }: { onPlaced: () => void }) {
  const navigate = useNavigate();
  const { items } = useCart();
  const { addresses, loading } = useAddresses();
  const [addressId, setAddressId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (addressId === null && addresses.length > 0) {
      setAddressId((addresses.find((a) => a.is_default) ?? addresses[0]).id);
    }
  }, [addresses, addressId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addressId === null) {
      setError("Choose a delivery address");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: number }>("/orders", {
        address_id: addressId,
        notes: notes.trim() || null,
        items: items.map((i) => ({ handle: i.handle, quantity: i.quantity })),
      });
      onPlaced();
      toast.success(`Order #${res.id} placed`);
      navigate("/account/orders", { state: { placed: res.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-3xl bg-white p-8 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]"
    >
      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Deliver to</legend>
        {loading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : addresses.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-secondary p-4 text-sm">
            <p>You don't have a saved address yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/account/addresses">
                <MapPin className="h-4 w-4" />
                Add an address
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {addresses.map((a) => (
              <label
                key={a.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm transition-colors",
                  addressId === a.id ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/50",
                )}
              >
                <input
                  type="radio"
                  name="address"
                  checked={addressId === a.id}
                  onChange={() => setAddressId(a.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{a.recipient_name}</span>
                  {a.is_default && (
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-muted-foreground">Default</span>
                  )}
                  <span className="block text-muted-foreground">
                    {[a.line1, a.line2, a.landmark, a.city, `${a.state} ${a.pincode}`].filter(Boolean).join(", ")}
                  </span>
                  <span className="block text-muted-foreground">{a.phone}</span>
                </span>
              </label>
            ))}
            <Link to="/account/addresses" className="text-sm text-muted-foreground underline underline-offset-2">
              Manage addresses
            </Link>
          </>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="order-notes" className="text-lg font-semibold">
          Notes <span className="text-sm font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="order-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Colour preferences, a gift message, a date you need it by..."
          className="rounded-2xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-3">
        <GradientButton
          type="submit"
          disabled={submitting || addresses.length === 0}
          className="self-start disabled:pointer-events-none disabled:opacity-50"
          innerClassName="px-10"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Placing order..." : "Place order"}
        </GradientButton>
        <p className="text-sm text-muted-foreground">
          No payment now. Every piece is handmade, so we'll confirm your order and share payment
          details with you before we start.
        </p>
      </div>
    </form>
  );
}
