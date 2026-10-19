import { Eye, Heart, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import type { Product } from "@/data/site-data";
import { formatRupees as rupees } from "@/lib/inventory";
import { cn } from "@/lib/utils";

/** Grid card: image with hover actions, category, title, price. */
export function ProductGridCard({
  product,
  categoryName,
  badge,
}: {
  product: Product;
  categoryName?: string;
  badge?: string;
}) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const saved = isWishlisted(product.handle);

  const add = () => {
    addItem({ handle: product.handle, title: product.title, price: product.price, image: product.image });
    toast.success(`${product.title} added to cart`);
  };

  return (
    <div className="group relative overflow-hidden rounded-[10px] border border-anon-cultured bg-white transition-shadow hover:shadow-[0_0_10px_hsla(0,0%,0%,0.15)]">
      <div className="relative aspect-square overflow-hidden bg-[#f7f5f2]">
        <Link to={`/product/${product.handle}`} aria-label={product.title}>
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        {badge && (
          <span className="absolute left-3 top-3 rounded-[5px] bg-anon-green px-2 py-0.5 text-[11px] font-medium text-white">
            {badge}
          </span>
        )}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5 transition-all duration-200 lg:translate-x-12 lg:group-hover:translate-x-0 lg:group-focus-within:translate-x-0">
          <ActionButton label={saved ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggleWishlist(product.handle)}>
            <Heart className={cn("h-4 w-4", saved && "fill-anon-pink text-anon-pink")} />
          </ActionButton>
          <ActionButton label="View piece" to={`/product/${product.handle}`}>
            <Eye className="h-4 w-4" />
          </ActionButton>
          <ActionButton label="Add to cart" onClick={add}>
            <ShoppingBag className="h-4 w-4" />
          </ActionButton>
        </div>
      </div>
      <div className="p-3.5">
        {categoryName && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-anon-pink">{categoryName}</p>
        )}
        <Link
          to={`/product/${product.handle}`}
          className="mt-0.5 line-clamp-1 text-sm text-anon-gray transition-colors hover:text-anon-black"
        >
          {product.title}
        </Link>
        <p className="mt-1.5 text-[15px] font-semibold text-anon-black">{rupees(product.price)}</p>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  to,
  children,
}: {
  label: string;
  onClick?: () => void;
  to?: string;
  children: React.ReactNode;
}) {
  const className =
    "flex h-8 w-8 items-center justify-center rounded-[5px] border border-anon-cultured bg-white text-anon-gray shadow-sm transition-colors hover:border-anon-black hover:bg-anon-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-anon-pink";
  return to ? (
    <Link to={to} aria-label={label} title={label} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {children}
    </button>
  );
}

/** Compact row card for the "New arrivals / Featured / ..." columns and the sidebar. */
export function ProductRowCard({ product, caption }: { product: Product; caption?: string }) {
  return (
    <Link
      to={`/product/${product.handle}`}
      className="group flex items-center gap-3.5 rounded-[10px] border border-anon-cultured bg-white p-2.5 transition-shadow hover:shadow-[0_0_10px_hsla(0,0%,0%,0.12)]"
    >
      <img
        src={product.image}
        alt=""
        loading="lazy"
        className="h-[70px] w-[70px] shrink-0 rounded-[6px] bg-[#f7f5f2] object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-anon-onyx group-hover:text-anon-black">{product.title}</p>
        {caption && <p className="truncate text-xs text-anon-gray">{caption}</p>}
        <p className="mt-0.5 text-sm font-semibold text-anon-pink">{rupees(product.price)}</p>
      </div>
    </Link>
  );
}
