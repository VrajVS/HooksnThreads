import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Eye,
  GitCompare,
  Grid3x3,
  Heart,
  List,
  MessageCircle,
  Palette,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

import { GradientButton } from "@/components/gradient-button";
import { QuickViewDialog } from "@/components/quick-view-dialog";
import { RecentlyViewed } from "@/components/recently-viewed";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/context/cart-context";
import { useCompare } from "@/context/compare-context";
import { useWishlist } from "@/context/wishlist-context";
import { useCategories } from "@/hooks/use-categories";
import { INSTAGRAM_URL, type Product } from "@/data/site-data";
import { cn } from "@/lib/utils";

type SortKey = "featured" | "newest" | "price-asc" | "price-desc" | "name-asc";
type ViewMode = "grid" | "list";

const SORT_LABEL: Record<SortKey, string> = {
  featured: "Featured",
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "name-asc": "Name: A–Z",
};

const SORT_KEYS: SortKey[] = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "name-asc",
];

const PRICE_CHIPS: { label: string; min: number; max: number }[] = [
  { label: "Under ₹200", min: 0, max: 200 },
  { label: "₹200–500", min: 200, max: 500 },
  { label: "₹500–1000", min: 500, max: 1000 },
  { label: "Above ₹1000", min: 1000, max: 0 },
];

const PAGE_SIZE = 12;

interface Props {
  title: string;
  subtitle?: string;
  products: Product[];
  loading: boolean;
  error?: string | null;
  emptyLabel?: string;
}

export function ProductListing({
  title,
  subtitle,
  products,
  loading,
  error,
  emptyLabel = "No pieces to show",
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const { addItem } = useCart();

  // URL-backed state — filter/sort/view/page all in the address bar.
  const selectedCats = (searchParams.get("cat") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const minPrice = Number(searchParams.get("min") ?? "") || 0;
  const maxPrice = Number(searchParams.get("max") ?? "") || 0;
  const featuredOnly = searchParams.get("featured") === "1";
  const sort = (searchParams.get("sort") as SortKey) || "featured";
  const view = (searchParams.get("view") as ViewMode) || "grid";
  const localSearch = searchParams.get("q_local") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const priceCeiling = useMemo(
    () => products.reduce((m, p) => Math.max(m, p.price), 0),
    [products],
  );

  function updateParams(mut: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mut(next);
    // A filter change always resets pagination.
    if (next.get("page")) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  function toggleCategory(slug: string) {
    const set = new Set(selectedCats);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    updateParams((p) => {
      if (set.size === 0) p.delete("cat");
      else p.set("cat", Array.from(set).join(","));
    });
  }

  function setPriceRange(min: number, max: number) {
    updateParams((p) => {
      if (min > 0) p.set("min", String(min));
      else p.delete("min");
      if (max > 0) p.set("max", String(max));
      else p.delete("max");
    });
  }

  function clearFilters() {
    updateParams((p) => {
      p.delete("cat");
      p.delete("min");
      p.delete("max");
      p.delete("featured");
      p.delete("sort");
      p.delete("q_local");
    });
  }

  const activeFilterCount =
    (selectedCats.length > 0 ? 1 : 0) +
    (minPrice > 0 || maxPrice > 0 ? 1 : 0) +
    (featuredOnly ? 1 : 0) +
    (localSearch ? 1 : 0);

  const shown = useMemo(() => {
    let list = products.slice();
    if (selectedCats.length > 0) {
      list = list.filter((p) => selectedCats.includes(p.category));
    }
    if (minPrice > 0) list = list.filter((p) => p.price >= minPrice);
    if (maxPrice > 0) list = list.filter((p) => p.price <= maxPrice);
    if (featuredOnly) list = list.filter((p) => p.featured);
    if (localSearch) {
      const q = localSearch.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    switch (sort) {
      case "newest":
        list.sort((a, b) => {
          const ad = a.created_at ? Date.parse(a.created_at) : 0;
          const bd = b.created_at ? Date.parse(b.created_at) : 0;
          return bd - ad;
        });
        break;
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "featured":
      default:
        list.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    }
    return list;
  }, [products, selectedCats, minPrice, maxPrice, featuredOnly, localSearch, sort]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paged = shown.slice(pageStart, pageStart + PAGE_SIZE);

  function setPage(n: number) {
    const next = new URLSearchParams(searchParams);
    if (n <= 1) next.delete("page");
    else next.set("page", String(n));
    setSearchParams(next, { replace: true });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Bulk-selection helpers
  function toggleBulk(handle: string) {
    setSelectedForBulk((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }
  function selectAllOnPage() {
    setSelectedForBulk((prev) => {
      const next = new Set(prev);
      paged.forEach((p) => next.add(p.handle));
      return next;
    });
  }
  function clearBulk() {
    setSelectedForBulk(new Set());
  }
  function addSelectedToCart() {
    let count = 0;
    selectedForBulk.forEach((handle) => {
      const p = products.find((x) => x.handle === handle);
      if (p) {
        addItem({
          handle: p.handle,
          title: p.title,
          price: p.price,
          image: p.image,
        });
        count += 1;
      }
    });
    clearBulk();
    setBulkMode(false);
  }

  // Turning bulk mode off clears the selection so it doesn't linger silently.
  useEffect(() => {
    if (!bulkMode) setSelectedForBulk(new Set());
  }, [bulkMode]);

  const filters = (
    <FilterPanel
      localSearch={localSearch}
      onLocalSearch={(v) =>
        updateParams((p) => (v ? p.set("q_local", v) : p.delete("q_local")))
      }
      categories={categories}
      selectedCats={selectedCats}
      toggleCategory={toggleCategory}
      minPrice={minPrice}
      maxPrice={maxPrice}
      priceCeiling={priceCeiling}
      onPriceChange={setPriceRange}
      featuredOnly={featuredOnly}
      onFeaturedChange={(v) =>
        updateParams((p) => (v ? p.set("featured", "1") : p.delete("featured")))
      }
      onClear={clearFilters}
      hasActive={activeFilterCount > 0}
    />
  );

  return (
    <>
      <div className="container py-10 md:py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24">{filters}</div>
          </aside>

          {/* Main column */}
          <div className="min-w-0 flex-1">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Loading pieces..."
                  : `${shown.length} piece${shown.length === 1 ? "" : "s"}`}
                {!loading && activeFilterCount > 0 && (
                  <>
                    {" "}
                    <button
                      onClick={clearFilters}
                      className="ml-2 text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-medium lg:hidden"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <ViewToggle
                  value={view}
                  onChange={(v) =>
                    updateParams((p) =>
                      v === "grid" ? p.delete("view") : p.set("view", v),
                    )
                  }
                />
                <button
                  onClick={() => setBulkMode((v) => !v)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                    bulkMode
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-white text-foreground",
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  {bulkMode ? "Selecting" : "Select multiple"}
                </button>
                <SortDropdown
                  value={sort}
                  onChange={(v) =>
                    updateParams((p) =>
                      v === "featured" ? p.delete("sort") : p.set("sort", v),
                    )
                  }
                />
              </div>
            </div>

            {loading ? (
              <GridSkeleton view={view} />
            ) : error ? (
              <ErrorState message={error} />
            ) : shown.length === 0 ? (
              <EmptyState label={emptyLabel} />
            ) : view === "list" ? (
              <div className="flex flex-col gap-4">
                {paged.map((p) => (
                  <ListCard
                    key={p.handle}
                    product={p}
                    onQuickView={() => setQuickView(p)}
                    bulkMode={bulkMode}
                    bulkSelected={selectedForBulk.has(p.handle)}
                    onToggleBulk={() => toggleBulk(p.handle)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {paged.map((p) => (
                  <GridCard
                    key={p.handle}
                    product={p}
                    onQuickView={() => setQuickView(p)}
                    bulkMode={bulkMode}
                    bulkSelected={selectedForBulk.has(p.handle)}
                    onToggleBulk={() => toggleBulk(p.handle)}
                  />
                ))}
              </div>
            )}

            {!loading && totalPages > 1 && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </div>
        </div>

        {/* Custom-order CTA */}
        {!loading && (
          <section className="mt-16 overflow-hidden rounded-3xl bg-foreground text-background">
            <div className="grid gap-6 p-8 md:grid-cols-[1fr_auto] md:items-center md:gap-10 md:p-12">
              <div>
                <h3 className="text-2xl font-semibold md:text-3xl">
                  Not seeing what you want?
                </h3>
                <p className="mt-3 text-sm text-background/70 md:text-base">
                  Every piece is made to order — share a reference photo, tell
                  us the colours you like, and we'll recreate it for you.
                </p>
              </div>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 self-start rounded-full bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:opacity-90 md:self-auto"
              >
                <MessageCircle className="h-4 w-4" />
                Request a custom piece
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </section>
        )}
      </div>

      {/* Recently viewed strip */}
      <RecentlyViewed />

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button
                aria-label="Close filters"
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">{filters}</div>
            <div className="border-t border-border p-4">
              <GradientButton
                className="w-full"
                onClick={() => setDrawerOpen(false)}
              >
                Show {shown.length} piece{shown.length === 1 ? "" : "s"}
              </GradientButton>
            </div>
          </div>
        </div>
      )}

      {/* Bulk-select floating bar */}
      {bulkMode && selectedForBulk.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-2xl px-4">
          <div className="flex items-center gap-3 rounded-full bg-foreground px-4 py-3 text-background shadow-2xl">
            <span className="text-sm font-medium">
              {selectedForBulk.size} selected
            </span>
            <button
              onClick={selectAllOnPage}
              className="text-xs font-medium text-background/70 underline underline-offset-2 hover:text-background"
            >
              Select page
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={clearBulk}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-background/80 hover:bg-background/10 hover:text-background"
              >
                Clear
              </button>
              <button
                onClick={addSelectedToCart}
                className="rounded-full bg-background px-4 py-1.5 text-sm font-semibold text-foreground hover:opacity-90"
              >
                Add all to cart
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickViewDialog
        product={quickView}
        open={!!quickView}
        onOpenChange={(o) => !o && setQuickView(null)}
      />
    </>
  );
}

/* ---------- filter panel ---------- */

function FilterPanel({
  localSearch,
  onLocalSearch,
  categories,
  selectedCats,
  toggleCategory,
  minPrice,
  maxPrice,
  priceCeiling,
  onPriceChange,
  featuredOnly,
  onFeaturedChange,
  onClear,
  hasActive,
}: {
  localSearch: string;
  onLocalSearch: (v: string) => void;
  categories: { slug: string; name: string }[];
  selectedCats: string[];
  toggleCategory: (slug: string) => void;
  minPrice: number;
  maxPrice: number;
  priceCeiling: number;
  onPriceChange: (min: number, max: number) => void;
  featuredOnly: boolean;
  onFeaturedChange: (v: boolean) => void;
  onClear: () => void;
  hasActive: boolean;
}) {
  const [minInput, setMinInput] = useState(minPrice ? String(minPrice) : "");
  const [maxInput, setMaxInput] = useState(maxPrice ? String(maxPrice) : "");
  const [searchInput, setSearchInput] = useState(localSearch);

  // Debounced local search — writes to URL after 250 ms of no typing.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== localSearch) onLocalSearch(searchInput);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput, localSearch, onLocalSearch]);

  // Keep local inputs in sync when Clear-all wipes URL params.
  useEffect(() => setMinInput(minPrice ? String(minPrice) : ""), [minPrice]);
  useEffect(() => setMaxInput(maxPrice ? String(maxPrice) : ""), [maxPrice]);
  useEffect(() => setSearchInput(localSearch), [localSearch]);

  const isChipActive = (chipMin: number, chipMax: number) =>
    (minPrice || 0) === chipMin && (maxPrice || 0) === chipMax;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[2px_4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Refine</h2>
        {hasActive && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      <FilterSection title="Search within">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="e.g. rose, bouquet"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
        />
      </FilterSection>

      <FilterSection title="Category">
        {categories.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => {
              const checked = selectedCats.includes(c.slug);
              return (
                <li key={c.slug}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(c.slug)}
                      className="h-4 w-4 rounded border-border accent-foreground"
                    />
                    <span
                      className={cn(
                        "text-muted-foreground",
                        checked && "font-medium text-foreground",
                      )}
                    >
                      {c.name}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </FilterSection>

      <FilterSection title="Price (₹)">
        <div className="mb-3 flex flex-wrap gap-2">
          {PRICE_CHIPS.map((chip) => {
            const active = isChipActive(chip.min, chip.max);
            return (
              <button
                key={chip.label}
                onClick={() => {
                  if (active) {
                    onPriceChange(0, 0);
                  } else {
                    onPriceChange(chip.min, chip.max);
                  }
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            onBlur={() =>
              onPriceChange(Number(minInput) || 0, Number(maxInput) || 0)
            }
            className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            onBlur={() =>
              onPriceChange(Number(minInput) || 0, Number(maxInput) || 0)
            }
            className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none"
          />
        </div>
        {priceCeiling > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Pieces here range up to ₹{priceCeiling.toLocaleString("en-IN")}
          </p>
        )}
      </FilterSection>

      <FilterSection title="Highlights">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(e) => onFeaturedChange(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-foreground"
          />
          <span
            className={cn(
              "text-muted-foreground",
              featuredOnly && "font-medium text-foreground",
            )}
          >
            Featured pieces only
          </span>
        </label>
      </FilterSection>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-border pt-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ---------- toolbar controls ---------- */

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex h-10 items-center overflow-hidden rounded-full border border-border bg-white p-0.5">
      <button
        aria-label="Grid view"
        onClick={() => onChange("grid")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          value === "grid"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Grid3x3 className="h-4 w-4" />
      </button>
      <button
        aria-label="List view"
        onClick={() => onChange("list")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          value === "list"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-medium"
      >
        Sort: <span className="text-muted-foreground">{SORT_LABEL[value]}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-10 w-52 overflow-hidden rounded-2xl bg-white p-1 shadow-[2px_4px_12px_rgba(0,0,0,0.12)]">
          {SORT_KEYS.map((k) => (
            <button
              key={k}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(k);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-accent",
                value === k
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {SORT_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- cards ---------- */

function CardBadges() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Truck className="h-3.5 w-3.5" strokeWidth={1.5} />
        7–14 days
      </span>
      <span className="inline-flex items-center gap-1">
        <Palette className="h-3.5 w-3.5" strokeWidth={1.5} />
        Any colour
      </span>
    </div>
  );
}

function WishlistButton({ product }: { product: Product }) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.handle);
  return (
    <button
      aria-label={
        wishlisted
          ? `Remove ${product.title} from wishlist`
          : `Add ${product.title} to wishlist`
      }
      onClick={() => toggleWishlist(product.handle)}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
    >
      <Heart
        className={cn(
          "h-4 w-4",
          wishlisted ? "fill-destructive text-destructive" : "text-foreground",
        )}
      />
    </button>
  );
}

function CardActionsRow({
  product,
  onQuickView,
}: {
  product: Product;
  onQuickView: () => void;
}) {
  const { isSelected, toggle } = useCompare();
  const compared = isSelected(product.handle);
  return (
    <div className="flex items-center justify-between text-xs">
      <button
        onClick={onQuickView}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
        Quick view
      </button>
      <button
        onClick={() => toggle(product.handle)}
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors",
          compared ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <GitCompare className="h-3.5 w-3.5" />
        {compared ? "Comparing" : "Compare"}
      </button>
    </div>
  );
}

function BulkCheckbox({
  checked,
  onChange,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "absolute z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white shadow-md",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-border accent-foreground"
        aria-label="Select for bulk add"
      />
    </label>
  );
}

function GridCard({
  product,
  onQuickView,
  bulkMode,
  bulkSelected,
  onToggleBulk,
}: {
  product: Product;
  onQuickView: () => void;
  bulkMode: boolean;
  bulkSelected: boolean;
  onToggleBulk: () => void;
}) {
  const { addItem } = useCart();

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-white shadow-[2px_4px_12px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[4px_8px_20px_rgba(0,0,0,0.10)]",
        bulkMode && bulkSelected && "ring-2 ring-foreground",
      )}
    >
      <div className="relative">
        <Link to={`/product/${product.handle}`} className="block">
          <img
            src={product.image}
            alt={product.title}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        <div className="absolute right-3 top-3">
          <WishlistButton product={product} />
        </div>
        {product.featured && !bulkMode && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-background">
            Featured
          </span>
        )}
        {bulkMode && (
          <BulkCheckbox
            checked={bulkSelected}
            onChange={onToggleBulk}
            className="left-3 top-3"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link to={`/product/${product.handle}`} className="min-h-[3rem]">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug hover:opacity-70">
            {product.title}
          </h3>
        </Link>
        <p className="text-sm text-muted-foreground">
          <span className="text-lg font-bold text-foreground">
            ₹{product.price.toLocaleString("en-IN")}
          </span>{" "}
          per piece
        </p>
        <CardBadges />
        <GradientButton
          className="mt-auto w-full"
          innerClassName="px-4 py-2 text-sm"
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
        <CardActionsRow product={product} onQuickView={onQuickView} />
      </div>
    </div>
  );
}

function ListCard({
  product,
  onQuickView,
  bulkMode,
  bulkSelected,
  onToggleBulk,
}: {
  product: Product;
  onQuickView: () => void;
  bulkMode: boolean;
  bulkSelected: boolean;
  onToggleBulk: () => void;
}) {
  const { addItem } = useCart();

  return (
    <div
      className={cn(
        "flex gap-4 overflow-hidden rounded-2xl bg-white p-4 shadow-[2px_4px_12px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[4px_8px_20px_rgba(0,0,0,0.10)]",
        bulkMode && bulkSelected && "ring-2 ring-foreground",
      )}
    >
      <div className="relative h-32 w-32 shrink-0 sm:h-40 sm:w-40">
        <Link to={`/product/${product.handle}`}>
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full rounded-xl object-cover"
          />
        </Link>
        {product.featured && !bulkMode && (
          <span className="absolute left-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-background">
            Featured
          </span>
        )}
        {bulkMode && (
          <BulkCheckbox
            checked={bulkSelected}
            onChange={onToggleBulk}
            className="left-2 top-2"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/product/${product.handle}`}>
            <h3 className="text-lg font-semibold hover:opacity-70">
              {product.title}
            </h3>
          </Link>
          <WishlistButton product={product} />
        </div>
        <p className="text-muted-foreground">
          <span className="text-xl font-bold text-foreground">
            ₹{product.price.toLocaleString("en-IN")}
          </span>{" "}
          per piece
        </p>
        <CardBadges />
        <p className="hidden text-sm text-muted-foreground sm:block">
          Made to order in your favourite colours. Wrapped and ready to gift.
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-3">
          <GradientButton
            innerClassName="px-5 py-2 text-sm"
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
          <div className="min-w-[10rem] flex-1">
            <CardActionsRow product={product} onQuickView={onQuickView} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- misc ---------- */

function GridSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl bg-white p-4 shadow-[2px_4px_12px_rgba(0,0,0,0.06)]"
          >
            <Skeleton className="h-32 w-32 rounded-xl sm:h-40 sm:w-40" />
            <div className="flex flex-1 flex-col gap-3 py-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl bg-white shadow-[2px_4px_12px_rgba(0,0,0,0.06)]"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
      <SearchX className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-lg font-medium">{label}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
      <p className="text-lg font-semibold text-destructive">
        Couldn't load pieces
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        The catalogue API didn't respond. Check that the dev server is running
        (both Vite on port 5180 and uvicorn on port 4000), then reload.
      </p>
      <p className="mt-1 rounded-lg bg-muted px-3 py-1 text-xs font-mono text-muted-foreground">
        {message}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-3 inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
      >
        Retry
      </button>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (n: number) => void;
}) {
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex h-10 items-center rounded-full border border-border bg-white px-4 text-sm font-medium disabled:opacity-40"
      >
        Previous
      </button>
      <span className="px-3 text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex h-10 items-center rounded-full border border-border bg-white px-4 text-sm font-medium disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
