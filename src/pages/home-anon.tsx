import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Gift,
  Heart,
  Minus,
  Palette,
  Plus,
  Sparkles,
  Truck,
  Hand,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ProductGridCard, ProductRowCard } from "@/components/storefront/product-cards";
import { PickOfTheDay, type Bestseller } from "@/components/storefront/pick-of-the-day";
import { StoreFooter } from "@/components/storefront/store-footer";
import { StoreHeader } from "@/components/storefront/store-header";
import { INSTAGRAM_URL, guides, type Category, type Product } from "@/data/site-data";
import { useCategories } from "@/hooks/use-categories";
import { useProducts } from "@/hooks/use-products";
import { api } from "@/lib/api";
import { formatRupees as rupees } from "@/lib/inventory";
import { cn } from "@/lib/utils";

const SLIDES = [
  { slug: "forever-flowers", eyebrow: "Blooms that never wilt", title: "Forever Flowers", image: "/images/carousel-flowers.jpg" },
  { slug: "festive", eyebrow: "Made for the season", title: "Festive Specials", image: "/images/carousel-festive.jpg" },
  { slug: "home-decor", eyebrow: "Soft, stitched touches", title: "Home Decor", image: "/images/carousel-homedecor.jpg" },
  { slug: "earrings", eyebrow: "Light as yarn", title: "Crochet Earrings", image: "/images/carousel-earrings.jpg" },
];

const SERVICES = [
  { icon: Hand, title: "Handmade to order", text: "Every piece is crocheted fresh for you" },
  { icon: Truck, title: "Shipping across India", text: "Dispatched in 7–14 days" },
  { icon: Palette, title: "Your colours", text: "Any design, in shades you choose" },
  { icon: Gift, title: "Gift wrapping", text: "Wrapped and ready to give" },
  { icon: Sparkles, title: "Gentle care", text: "Cold hand-wash, lay flat to dry" },
];

const PAGE = 12;

export function StorefrontHome() {
  const { products, loading } = useProducts();
  const { categories } = useCategories();
  const [bestsellers, setBestsellers] = useState<Bestseller[]>([]);

  useEffect(() => {
    api
      .get<Bestseller[]>("/products/bestsellers?limit=8")
      .then(setBestsellers)
      .catch(() => setBestsellers([]));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of products) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [products]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories]);
  const visibleCategories = categories.filter((c) => (counts[c.slug] ?? 0) > 0);

  return (
    <div className="min-h-screen bg-white font-poppins text-anon-black">
      <StoreHeader categories={visibleCategories} counts={counts} />
      <main>
        <h1 className="sr-only">Hooks &amp; Threads: handmade crochet flowers, keychains and accessories</h1>
        <Banner products={products} />
        <CategoryStrip categories={[...visibleCategories].sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0))} counts={counts} />

        <div className="mx-auto flex max-w-[1200px] gap-7 px-4 pb-10">
          <Sidebar
            categories={visibleCategories}
            products={products}
            bestsellers={bestsellers.slice(0, 4)}
            categoryName={categoryName}
          />
          <div className="min-w-0 flex-1">
            <ProductColumns products={products} bestsellers={bestsellers} categoryName={categoryName} />
            <PickOfTheDay products={products} bestsellers={bestsellers} categoryName={categoryName} />
            <AllPieces products={products} loading={loading} categoryName={categoryName} bestsellers={bestsellers} />
          </div>
        </div>

        <StudioRow />
        <Guides />
      </main>
      <StoreFooter categories={visibleCategories} products={products} />
    </div>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("mb-5 border-b border-anon-cultured pb-2.5 text-[17px] font-semibold text-anon-black", className)}>
      {children}
    </h2>
  );
}

/* ---------- Banner ---------- */

function Banner({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  const from = (slug: string) => {
    const prices = products.filter((p) => p.category === slug).map((p) => p.price);
    return prices.length ? Math.min(...prices) : null;
  };

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      if (!paused.current) go((index + 1) % SLIDES.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [index]);

  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-7" aria-roledescription="carousel" aria-label="Featured collections">
      <div
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-[10px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s, i) => {
          const price = from(s.slug);
          return (
            <div
              key={s.slug}
              className="relative flex h-[280px] w-full shrink-0 snap-start overflow-hidden bg-[#fbeee9] sm:h-[340px] lg:h-[400px]"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
            >
              <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-5 sm:px-12">
                <p className="text-sm text-anon-pink sm:text-xl md:text-2xl">{s.eyebrow}</p>
                <h3 className="mt-1 text-2xl font-extrabold uppercase leading-tight text-anon-black sm:text-4xl md:text-5xl">
                  {s.title}
                </h3>
                {price !== null && (
                  <p className="mt-2 text-sm text-anon-gray sm:text-lg">
                    starting at <b className="text-xl font-semibold text-anon-black sm:text-2xl">{rupees(price)}</b>
                  </p>
                )}
                <Link
                  to={`/category/${s.slug}`}
                  className="mt-5 w-fit rounded-[5px] bg-anon-pink px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-anon-black"
                >
                  Shop now
                </Link>
              </div>
              <img
                src={s.image}
                alt=""
                className="h-full w-[40%] max-w-[460px] shrink-0 object-cover sm:w-[45%]"
                loading={i === 0 ? "eager" : "lazy"}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show ${s.title}`}
            aria-current={i === index}
            className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-anon-pink" : "w-2 bg-anon-cultured hover:bg-anon-silver")}
          />
        ))}
      </div>
    </section>
  );
}

/* ---------- Category strip ---------- */

function CategoryStrip({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8" aria-label="Categories">
      <div className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {categories.map((c) => (
          <Link
            key={c.slug}
            to={`/category/${c.slug}`}
            className="group flex min-w-[260px] snap-start items-center gap-4 rounded-[10px] border border-anon-cultured p-3.5 transition-shadow hover:shadow-[0_0_10px_hsla(0,0%,0%,0.1)]"
          >
            <img src={c.image} alt="" className="h-14 w-14 shrink-0 rounded-[8px] bg-anon-cultured object-cover" loading="lazy" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-semibold uppercase text-anon-black">{c.name}</p>
                <span className="text-xs text-anon-silver">({counts[c.slug] ?? 0})</span>
              </div>
              <p className="mt-1 text-xs text-anon-pink group-hover:underline">Show all</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- Sidebar ---------- */

function Sidebar({
  categories,
  products,
  bestsellers,
  categoryName,
}: {
  categories: Category[];
  products: Product[];
  bestsellers: Bestseller[];
  categoryName: Map<string, string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <aside className="hidden w-[260px] shrink-0 self-start lg:block">
      <div className="mb-7 rounded-[10px] border border-anon-cultured p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em]">Category</h2>
        <ul>
          {categories.map((c) => {
            const items = products.filter((p) => p.category === c.slug);
            const expanded = open === c.slug;
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : c.slug)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-2.5 py-2 text-left text-[15px] text-anon-onyx hover:text-anon-black"
                >
                  <img src={c.image} alt="" className="h-5 w-5 rounded-full object-cover" />
                  <span className="flex-1">{c.name}</span>
                  {expanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
                {expanded && (
                  <ul className="mb-2 border-l border-anon-cultured pl-4">
                    {items.slice(0, 6).map((p) => (
                      <li key={p.handle}>
                        <Link
                          to={`/product/${p.handle}`}
                          className="flex justify-between gap-2 py-1 text-sm text-anon-gray hover:text-anon-pink"
                        >
                          <span className="truncate">{p.title}</span>
                          <span className="shrink-0 text-anon-silver">{rupees(p.price)}</span>
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link to={`/category/${c.slug}`} className="block py-1 text-sm font-medium text-anon-pink hover:underline">
                        All {items.length} pieces
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {bestsellers.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.1em]">Best sellers</h2>
          <div className="flex flex-col gap-3">
            {bestsellers.map((p) => (
              <ProductRowCard key={p.handle} product={p} caption={`${categoryName.get(p.category) ?? ""} · ${p.sold} sold`} />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

/* ---------- Product columns ---------- */

function ProductColumns({
  products,
  bestsellers,
  categoryName,
}: {
  products: Product[];
  bestsellers: Bestseller[];
  categoryName: Map<string, string>;
}) {
  if (products.length === 0) return null;
  const newest = [...products]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.title.localeCompare(a.title))
    .slice(0, 4);
  const featured = products.filter((p) => p.featured).slice(0, 4);
  const loved = bestsellers.slice(4, 8).length === 4 ? bestsellers.slice(4, 8) : bestsellers.slice(0, 4);
  const columns: { title: string; items: Product[] }[] = [
    { title: "New arrivals", items: newest },
    { title: featured.length ? "Featured" : "Under ₹150", items: featured.length ? featured : products.filter((p) => p.price <= 150).slice(0, 4) },
    { title: "Most loved", items: loved.length ? loved : products.filter((p) => p.price <= 150).slice(0, 4) },
  ];
  return (
    <section className="mb-10 grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
      {columns.map((col) =>
        col.items.length ? (
          <div key={col.title}>
            <SectionTitle>{col.title}</SectionTitle>
            <div className="flex flex-col gap-3">
              {col.items.map((p) => (
                <ProductRowCard key={p.handle} product={p} caption={categoryName.get(p.category)} />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </section>
  );
}

/* ---------- All pieces ---------- */

function AllPieces({
  products,
  loading,
  categoryName,
  bestsellers,
}: {
  products: Product[];
  loading: boolean;
  categoryName: Map<string, string>;
  bestsellers: Bestseller[];
}) {
  const [shown, setShown] = useState(PAGE);
  const top = new Set(bestsellers.slice(0, 8).map((b) => b.handle));
  // Round-robin across categories (largest first) so every row shows a mix.
  const ordered = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of products) groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
    const queues = [...groups.values()].sort((a, b) => b.length - a.length);
    const mixed: Product[] = [];
    for (let i = 0; mixed.length < products.length; i++) {
      for (const q of queues) if (q[i]) mixed.push(q[i]);
    }
    return mixed;
  }, [products]);

  return (
    <section>
      <SectionTitle>Explore the collection</SectionTitle>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-[10px] bg-anon-cultured" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {ordered.slice(0, shown).map((p) => (
              <ProductGridCard
                key={p.handle}
                product={p}
                categoryName={categoryName.get(p.category)}
                badge={top.has(p.handle) ? "Bestseller" : undefined}
              />
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {shown < ordered.length && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-[5px] bg-anon-black px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-anon-pink"
              >
                Load more
              </button>
            )}
            <Link
              to="/products"
              className="flex items-center gap-1.5 rounded-[5px] border border-anon-cultured px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-anon-onyx hover:border-anon-black"
            >
              Shop all {ordered.length} pieces <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- Studio row: Instagram, CTA, services ---------- */

function StudioRow() {
  return (
    <section className="mx-auto grid max-w-[1200px] gap-7 px-4 py-10 md:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1fr]">
      <div>
        <SectionTitle>From the maker</SectionTitle>
        <div className="flex flex-col items-center rounded-[10px] border border-anon-cultured px-6 py-8 text-center">
          <img src="/images/logo-icon.png" alt="" className="h-20 w-20 rounded-full" />
          <p className="mt-4 font-semibold uppercase text-anon-black">Hooks &amp; Threads</p>
          <p className="text-xs text-anon-gray">Handmade crochet studio</p>
          <Heart className="my-4 h-5 w-5 fill-anon-pink text-anon-pink" />
          <p className="text-sm leading-relaxed text-anon-gray">
            Every flower, keychain and clip is made stitch by stitch, only after you order. Follow along for new
            pieces and behind-the-scenes.
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 text-sm font-semibold text-anon-pink hover:underline"
          >
            @hooksnthreads_official
          </a>
        </div>
      </div>

      <div className="relative min-h-[320px] overflow-hidden rounded-[10px] md:col-span-2 lg:col-span-1">
        <img src="/images/how-to-order.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-white from-40% via-white/75 via-60% to-transparent" />
        <div className="relative flex h-full flex-col justify-center p-8">
          <span className="w-fit rounded-[5px] bg-anon-black px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white">
            Made for you
          </span>
          <h3 className="mt-3 max-w-[16ch] text-2xl font-bold text-anon-black sm:text-3xl">Custom orders in your colours</h3>
          <p className="mt-2 max-w-[34ch] text-sm text-anon-onyx">
            Tell us the piece, the shades and the occasion. We'll confirm timing and price before you pay.
          </p>
          <Link
            to="/contact"
            className="mt-5 w-fit text-sm font-semibold uppercase tracking-wide text-anon-black underline decoration-anon-pink decoration-2 underline-offset-4 hover:text-anon-pink"
          >
            Start a custom order
          </Link>
        </div>
      </div>

      <div>
        <SectionTitle>Our promise</SectionTitle>
        <ul className="flex flex-col gap-4 rounded-[10px] border border-anon-cultured p-6">
          {SERVICES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-4">
              <Icon className="h-7 w-7 shrink-0 text-anon-pink" strokeWidth={1.4} />
              <div>
                <p className="text-sm font-medium text-anon-black">{title}</p>
                <p className="text-xs text-anon-gray">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Guides (the template's blog row) ---------- */

function Guides() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-14">
      <SectionTitle>Guides from the studio</SectionTitle>
      <div className="flex snap-x gap-6 overflow-x-auto pb-2">
        {guides.map((g) => {
          const href = g.href.startsWith("#") ? "/contact" : g.href;
          return (
            <Link key={g.category} to={href} className="group w-[280px] shrink-0 snap-start sm:w-[300px]">
              <div className="aspect-[16/10] overflow-hidden rounded-[10px]">
                <img
                  src={g.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-anon-pink">{g.category}</p>
              <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-anon-black group-hover:text-anon-pink">
                {g.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
