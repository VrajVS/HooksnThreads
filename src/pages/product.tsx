import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Minus, Palette, Plus, Truck } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/gradient-button";
import { RecentlyViewed } from "@/components/recently-viewed";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { useProduct } from "@/hooks/use-product";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { INSTAGRAM_URL } from "@/data/site-data";
import { cn } from "@/lib/utils";

const features = [
  { icon: Heart, text: "100% handcrafted, one stitch at a time" },
  { icon: Palette, text: "Fully customizable in your favourite colours" },
  { icon: Truck, text: "Shipped pan India, wrapped and ready" },
];

export function ProductPage() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { product, loading, notFound } = useProduct(handle);
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { track } = useRecentlyViewed();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function goBack() {
    // Use browser history when we came from within the app; otherwise
    // fall back to the shop landing so the button always does something.
    if (window.history.length > 1) navigate(-1);
    else navigate("/products");
  }

  useEffect(() => {
    if (product?.handle) track(product.handle);
  }, [product?.handle, track]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container flex flex-col items-center gap-4 py-32 text-center">
          <h1 className="text-3xl font-semibold">Product not found</h1>
          <Link to="/" className="text-sm font-medium underline">
            Back to home
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-32 text-center text-muted-foreground">Loading...</div>
        <Footer />
      </div>
    );
  }

  const wishlisted = isWishlisted(product.handle);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-8">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      <main className="container grid gap-12 pb-16 pt-8 lg:grid-cols-2 lg:gap-16">
        <img
          src={product.image}
          alt={product.title}
          className="aspect-square w-full rounded-2xl object-cover shadow-lg"
        />

        <div className="flex flex-col justify-center">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-4xl font-semibold md:text-5xl">
              {product.title}
            </h1>
            <button
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              onClick={() => toggleWishlist(product.handle)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-accent"
            >
              <Heart
                className={cn(
                  "h-5 w-5",
                  wishlisted ? "fill-destructive text-destructive" : "text-foreground",
                )}
              />
            </button>
          </div>
          <p className="mt-4 text-2xl font-bold">
            ₹{product.price}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              per piece
            </span>
          </p>

          <div className="mt-8 flex flex-col gap-4">
            {features.map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <feature.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                <span className="text-base">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-full border border-border px-3 py-2">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center font-medium">{quantity}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                addItem(
                  {
                    handle: product.handle,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                  },
                  quantity,
                );
                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
              }}
            >
              {added ? "Added to Cart" : "Add to Cart"}
            </Button>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Want a custom colour or size?</span>
            <GradientButton
              as="a"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              innerClassName="px-4 py-1.5 text-xs"
            >
              Message us
            </GradientButton>
          </div>
        </div>
      </main>
      <RecentlyViewed excludeHandle={product.handle} />
      <Footer />
    </div>
  );
}
