import { useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { useCart } from "@/context/cart-context";
import type { Product } from "@/data/site-data";
import { useCategories } from "@/hooks/use-categories";
import { useProducts } from "@/hooks/use-products";
import { api } from "@/lib/api";
import { formatRupees as rupees } from "@/lib/inventory";

export type Bestseller = Product & { sold: number };

/** Days since 1 Jan 1970 in the visitor's own time zone, so it rolls over at their midnight. */
function localDay() {
  return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
}

function untilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function PickOfTheDay({
  products,
  bestsellers,
  categoryName,
}: {
  products: Product[];
  bestsellers: Bestseller[];
  categoryName: Map<string, string>;
}) {
  const { addItem } = useCart();
  const [left, setLeft] = useState(untilMidnight);
  const [day, setDay] = useState(localDay);

  useEffect(() => {
    // The same tick that runs the countdown moves on to the next pick at midnight.
    const id = window.setInterval(() => {
      setLeft(untilMidnight());
      setDay(localDay());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // A different well-liked piece each day, the same for every visitor on that day.
  const pool = bestsellers.length ? bestsellers : products.filter((p) => p.featured);
  if (!pool.length) return null;
  const pick = pool[day % pool.length];
  const sold = "sold" in pick ? (pick as Bestseller).sold : null;

  const add = () => {
    addItem({ handle: pick.handle, title: pick.title, price: pick.price, image: pick.image });
    toast.success(`${pick.title} added to cart`);
  };

  return (
    <section className="mb-10">
      <h2 className="mb-5 border-b border-anon-cultured pb-2.5 text-[17px] font-semibold text-anon-black">Pick of the day</h2>
      <div className="flex flex-col gap-6 rounded-[10px] border border-anon-cultured p-5 sm:p-7 md:flex-row md:items-center">
        <Link to={`/product/${pick.handle}`} className="mx-auto w-full max-w-[300px] shrink-0">
          <img src={pick.image} alt={pick.title} className="aspect-square w-full rounded-[8px] bg-[#f7f5f2] object-cover" />
        </Link>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-anon-pink">{categoryName.get(pick.category)}</p>
          <Link to={`/product/${pick.handle}`} className="mt-1 block text-xl font-semibold uppercase text-anon-black hover:text-anon-pink">
            {pick.title}
          </Link>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-anon-gray">
            Crocheted by hand once you order, in the colours you pick. Dispatched within 7–14 days and wrapped ready to give.
          </p>
          <p className="mt-4 text-2xl font-semibold text-anon-pink">{rupees(pick.price)}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={add}
              className="flex items-center gap-2 rounded-[5px] bg-anon-pink px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-anon-black"
            >
              <ShoppingBag className="h-4 w-4" /> Add to cart
            </button>
            <Link
              to={`/product/${pick.handle}`}
              className="rounded-[5px] border border-anon-cultured px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-anon-onyx hover:border-anon-black"
            >
              View piece
            </Link>
          </div>
          {sold !== null && (
            <p className="mt-5 text-xs uppercase tracking-wide text-anon-gray">
              Loved by customers: <b className="text-anon-black">{sold} sold</b>
            </p>
          )}
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-anon-black">Next pick in</p>
            <div className="flex gap-2.5" role="timer" aria-live="off">
              {[
                [left.h, "Hours"],
                [left.m, "Min"],
                [left.s, "Sec"],
              ].map(([v, label]) => (
                <div key={label} className="w-14 rounded-[5px] bg-anon-cultured py-1.5 text-center">
                  <p className="text-lg font-medium tabular-nums text-anon-black">{String(v).padStart(2, "0")}</p>
                  <p className="text-[10px] uppercase text-anon-gray">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/** Self-loading version for pages that don't already have the catalogue (the classic home page). */
export function PickOfTheDaySection() {
  const { products } = useProducts();
  const { categories } = useCategories();
  const [bestsellers, setBestsellers] = useState<Bestseller[]>([]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories]);

  useEffect(() => {
    api
      .get<Bestseller[]>("/products/bestsellers?limit=8")
      .then(setBestsellers)
      .catch(() => setBestsellers([]));
  }, []);

  return (
    <section className="bg-[hsl(37,20%,85%)] py-10 font-poppins md:py-12 text-anon-black">
      <div className="container">
        <div className="mx-auto max-w-5xl rounded-[14px] bg-white p-3 sm:p-6 [&>section]:mb-0">
          <PickOfTheDay products={products} bestsellers={bestsellers} categoryName={categoryName} />
        </div>
      </div>
    </section>
  );
}
