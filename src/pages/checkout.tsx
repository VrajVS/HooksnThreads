import { Link } from "react-router-dom";
import { Clock } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/gradient-button";
import { useCart } from "@/context/cart-context";
import { INSTAGRAM_URL } from "@/data/site-data";

export function CheckoutPage() {
  const { items, subtotal } = useCart();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container flex flex-col items-center py-16 text-center">
        <div className="flex max-w-xl flex-col items-center gap-4 rounded-3xl bg-white p-12 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
          <Clock className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
          <h1 className="text-3xl font-semibold">Online checkout is coming soon</h1>
          <p className="text-muted-foreground">
            We're setting up secure online payments. In the meantime, send us
            your cart on Instagram and we'll confirm pricing and get your
            order started right away.
          </p>

          {items.length > 0 && (
            <div className="mt-2 w-full rounded-2xl bg-secondary p-4 text-left text-sm">
              <p className="font-semibold">Your cart ({items.length} item{items.length === 1 ? "" : "s"})</p>
              <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                {items.map((item) => (
                  <li key={item.handle}>
                    {item.quantity} × {item.title} — ₹{item.price * item.quantity}
                  </li>
                ))}
              </ul>
              <div className="mt-2 border-t border-border pt-2 font-semibold text-foreground">
                Subtotal: ₹{subtotal}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <GradientButton as="a" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Message us on Instagram
            </GradientButton>
            <Button asChild variant="outline" size="lg">
              <Link to="/cart">Back to Cart</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
