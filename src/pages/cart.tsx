import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/cart-context";

export function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-16">
        <h1 className="font-brand text-4xl font-semibold md:text-5xl">Your Cart</h1>

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-lg font-medium">Your cart is empty</p>
            <Button asChild size="lg" className="mt-2">
              <Link to="/#products">Browse Catalogue</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-12 grid gap-12 lg:grid-cols-3 lg:gap-16">
            <div className="flex flex-col gap-6 lg:col-span-2">
              {items.map((item) => (
                <div
                  key={item.handle}
                  className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      ₹{item.price} per piece
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border px-2 py-1">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => updateQuantity(item.handle, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() => updateQuantity(item.handle, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="w-20 text-right font-semibold">
                    ₹{item.price * item.quantity}
                  </p>
                  <button
                    aria-label={`Remove ${item.title}`}
                    onClick={() => removeItem(item.handle)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="h-fit rounded-3xl bg-white p-6 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
              <h2 className="text-xl font-semibold">Order Summary</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹{subtotal}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">Calculated at checkout</span>
              </div>
              <div className="my-4 border-t border-border" />
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>₹{subtotal}</span>
              </div>
              <Button asChild size="lg" className="mt-6 w-full">
                <Link to="/checkout">Proceed to Checkout</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
