import { Link } from "react-router-dom";
import { ArrowRight, Heart, Palette, Truck } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { GradientButton } from "@/components/gradient-button";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import type { Product } from "@/data/site-data";
import { cn } from "@/lib/utils";

interface Props {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickViewDialog({ product, open, onOpenChange }: Props) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  if (!product) return null;
  const wishlisted = isWishlisted(product.handle);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="relative aspect-square bg-muted">
            <img
              src={product.image}
              alt={product.title}
              className="h-full w-full object-cover"
            />
            {product.featured && (
              <span className="absolute left-4 top-4 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-background">
                Featured
              </span>
            )}
          </div>
          <div className="flex flex-col gap-5 p-6 md:p-8">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-semibold leading-tight">
                {product.title}
              </h2>
              <button
                aria-label={
                  wishlisted
                    ? `Remove ${product.title} from wishlist`
                    : `Add ${product.title} to wishlist`
                }
                onClick={() => toggleWishlist(product.handle)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-accent"
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    wishlisted
                      ? "fill-destructive text-destructive"
                      : "text-foreground",
                  )}
                />
              </button>
            </div>
            <p className="text-2xl font-bold">
              ₹{product.price.toLocaleString("en-IN")}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                per piece
              </span>
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Truck className="h-4 w-4" strokeWidth={1.5} />
                Made to order · ships in 7–14 days
              </li>
              <li className="flex items-center gap-2">
                <Palette className="h-4 w-4" strokeWidth={1.5} />
                Customizable in your favourite colours
              </li>
              <li className="flex items-center gap-2">
                <Heart className="h-4 w-4" strokeWidth={1.5} />
                100% handcrafted, one stitch at a time
              </li>
            </ul>
            <div className="mt-auto flex flex-col gap-3">
              <GradientButton
                className="w-full"
                onClick={() => {
                  addItem({
                    handle: product.handle,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                  });
                }}
              >
                Add to Cart
              </GradientButton>
              <Link
                to={`/product/${product.handle}`}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                View full details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
