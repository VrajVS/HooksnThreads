import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Heart, Palette, Truck, X } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GradientButton } from "@/components/gradient-button";
import { useCart } from "@/context/cart-context";
import { useCompare } from "@/context/compare-context";
import { useWishlist } from "@/context/wishlist-context";
import { useProducts } from "@/hooks/use-products";
import { cn } from "@/lib/utils";

const ROWS = [
  {
    label: "Price",
    render: (p: { price: number }) => (
      <span className="text-lg font-bold">
        ₹{p.price.toLocaleString("en-IN")}
      </span>
    ),
  },
  {
    label: "Category",
    render: (p: { category: string }) => (
      <span className="capitalize text-muted-foreground">
        {p.category.replace(/-/g, " ")}
      </span>
    ),
  },
  {
    label: "Featured",
    render: (p: { featured?: boolean }) =>
      p.featured ? (
        <Check className="h-4 w-4 text-foreground" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      ),
  },
  {
    label: "Lead time",
    render: () => (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Truck className="h-4 w-4" strokeWidth={1.5} />
        7–14 days
      </span>
    ),
  },
  {
    label: "Colours",
    render: () => (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Palette className="h-4 w-4" strokeWidth={1.5} />
        Customizable
      </span>
    ),
  },
] as const;

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const { handles, toggle, clear } = useCompare();
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { products, loading } = useProducts();

  // URL takes precedence so a shared link works even if the local set is stale/empty.
  const urlHandles = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const effectiveHandles = urlHandles.length > 0 ? urlHandles : handles;

  const items = effectiveHandles
    .map((h) => products.find((p) => p.handle === h))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10 md:py-14">
        <Link
          to="/products"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shop
        </Link>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold md:text-4xl">Compare pieces</h1>
            <p className="mt-2 text-muted-foreground">
              Side-by-side view of what you've picked.
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={clear}
              className="text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
            <p className="text-lg font-medium">Nothing to compare yet</p>
            <p className="text-sm text-muted-foreground">
              Tick the "Compare" checkbox on a few pieces from the shop.
            </p>
            <Link
              to="/products"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2"
            >
              Browse the catalogue
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `minmax(120px, 160px) repeat(${items.length}, minmax(220px, 1fr))`,
              }}
            >
              {/* Header row: images + titles + actions */}
              <div />
              {items.map((p) => {
                const wishlisted = isWishlisted(p.handle);
                return (
                  <div
                    key={p.handle}
                    className="rounded-2xl bg-white p-4 shadow-[2px_4px_12px_rgba(0,0,0,0.06)]"
                  >
                    <div className="relative">
                      <Link to={`/product/${p.handle}`}>
                        <img
                          src={p.image}
                          alt={p.title}
                          className="aspect-square w-full rounded-xl object-cover"
                        />
                      </Link>
                      <button
                        aria-label={`Remove ${p.title} from compare`}
                        onClick={() => toggle(p.handle)}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Link
                      to={`/product/${p.handle}`}
                      className="mt-3 block text-base font-semibold hover:opacity-70"
                    >
                      {p.title}
                    </Link>
                    <div className="mt-3 flex items-center gap-2">
                      <GradientButton
                        className="flex-1"
                        innerClassName="px-3 py-1.5 text-xs"
                        onClick={() =>
                          addItem({
                            handle: p.handle,
                            title: p.title,
                            price: p.price,
                            image: p.image,
                          })
                        }
                      >
                        Add
                      </GradientButton>
                      <button
                        aria-label="Toggle wishlist"
                        onClick={() => toggleWishlist(p.handle)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white hover:bg-accent"
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
                  </div>
                );
              })}

              {/* Attribute rows */}
              {ROWS.map((row) => (
                <ContentsRow key={row.label} label={row.label}>
                  {items.map((p) => (
                    <div key={p.handle} className="text-sm">
                      {row.render(p)}
                    </div>
                  ))}
                </ContentsRow>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ContentsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center px-2 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {/* React.Children.toArray keeps keys stable */}
      {Array.isArray(children)
        ? children.map((c, i) => (
            <div
              key={i}
              className="flex items-center rounded-xl bg-white px-4 py-3 shadow-[2px_4px_12px_rgba(0,0,0,0.04)]"
            >
              {c}
            </div>
          ))
        : children}
    </>
  );
}
