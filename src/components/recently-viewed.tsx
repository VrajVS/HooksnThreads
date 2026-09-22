import { Link } from "react-router-dom";

import { useProducts } from "@/hooks/use-products";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";

interface Props {
  /** Optional handle to hide from the strip (e.g. the current product page). */
  excludeHandle?: string;
}

export function RecentlyViewed({ excludeHandle }: Props) {
  const { handles } = useRecentlyViewed();
  const { products } = useProducts();

  const filtered = handles
    .filter((h) => h !== excludeHandle)
    .map((h) => products.find((p) => p.handle === h))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (filtered.length === 0) return null;

  return (
    <section className="border-t border-border/50 bg-background py-12">
      <div className="container">
        <h2 className="mb-6 text-xl font-semibold md:text-2xl">
          Recently viewed
        </h2>
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-4 pb-2">
            {filtered.map((p) => (
              <Link
                key={p.handle}
                to={`/product/${p.handle}`}
                className="group w-40 shrink-0 md:w-48"
              >
                <div className="overflow-hidden rounded-2xl bg-white shadow-[2px_4px_12px_rgba(0,0,0,0.06)]">
                  <img
                    src={p.image}
                    alt={p.title}
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-medium">
                  {p.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  ₹{p.price.toLocaleString("en-IN")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
