import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

import { GradientButton } from "@/components/gradient-button";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import type { Product } from "@/data/site-data";
import { cn } from "@/lib/utils";

export function ProductGrid({ products }: { products: Product[] }) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const wishlisted = isWishlisted(product.handle);
        return (
          <div key={product.handle} className="flex flex-col gap-4">
            <div className="relative">
              <Link to={`/product/${product.handle}`}>
                <img
                  src={product.image}
                  alt={product.title}
                  className="aspect-square w-full rounded-2xl object-cover shadow-lg transition-shadow hover:shadow-xl"
                />
              </Link>
              <button
                aria-label={
                  wishlisted ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`
                }
                onClick={() => toggleWishlist(product.handle)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    wishlisted ? "fill-destructive text-destructive" : "text-foreground",
                  )}
                />
              </button>
            </div>
            <Link to={`/product/${product.handle}`}>
              <h3 className="text-2xl font-semibold hover:opacity-70">
                {product.title}
              </h3>
            </Link>
            <p className="text-muted-foreground">
              <span className="text-xl font-bold text-foreground">
                ₹{product.price}
              </span>{" "}
              per piece
            </p>
            <GradientButton
              className="w-full"
              onClick={() =>
                addItem({
                  handle: product.handle,
                  title: product.title,
                  price: product.price,
                  image: product.image,
                })
              }
            >
              Add to Cart
            </GradientButton>
          </div>
        );
      })}
    </div>
  );
}
