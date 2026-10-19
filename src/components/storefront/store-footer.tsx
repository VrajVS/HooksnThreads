import { Mail, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import { INSTAGRAM_URL, type Category, type Product } from "@/data/site-data";

const CONTACT_EMAIL = "hello@hooksnthreads.shop";

/** Dark footer: a link cloud of every category and its pieces, then link columns. */
export function StoreFooter({ categories, products }: { categories: Category[]; products: Product[] }) {
  const byCategory = new Map<string, Product[]>();
  for (const p of products) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  // The busiest categories make the most useful link cloud.
  const cloud = [...categories]
    .sort((a, b) => (byCategory.get(b.slug)?.length ?? 0) - (byCategory.get(a.slug)?.length ?? 0))
    .slice(0, 6);

  return (
    <footer className="bg-anon-black pb-24 font-poppins text-sm text-anon-silver lg:pb-0">
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">Shop by category</h2>
          <div className="flex flex-col gap-2.5">
            {cloud.map((c) => (
              <p key={c.slug} className="leading-relaxed">
                <Link to={`/category/${c.slug}`} className="mr-2 font-semibold uppercase text-anon-silver hover:text-white">
                  {c.name} :
                </Link>
                {(byCategory.get(c.slug) ?? []).slice(0, 10).map((p, i, list) => (
                  <span key={p.handle}>
                    <Link to={`/product/${p.handle}`} className="hover:text-white">
                      {p.title}
                    </Link>
                    {i < list.length - 1 && <span className="mx-2 text-white/25">|</span>}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <FooterColumn
          title="Popular categories"
          links={cloud.slice(0, 5).map((c) => ({ label: c.name, to: `/category/${c.slug}` }))}
        />
        <FooterColumn
          title="Shop"
          links={[
            { label: "Shop all", to: "/products" },
            { label: "Compare pieces", to: "/compare" },
            { label: "Wishlist", to: "/wishlist" },
            { label: "Cart", to: "/cart" },
            { label: "My orders", to: "/account/orders" },
          ]}
        />
        <FooterColumn
          title="Policies"
          links={[
            { label: "Privacy policy", to: "/privacy-policy" },
            { label: "Terms of service", to: "/terms-of-service" },
            { label: "Refund policy", to: "/refund-policy" },
            { label: "Shipping policy", to: "/shipping-policy" },
          ]}
        />
        <FooterColumn
          title="Studio"
          links={[
            { label: "Contact", to: "/contact" },
            { label: "Custom orders", to: "/contact" },
            { label: "Instagram", to: INSTAGRAM_URL, external: true },
          ]}
        />
        <div>
          <h2 className="relative mb-5 pb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white after:absolute after:bottom-0 after:left-0 after:h-px after:w-14 after:bg-anon-pink">
            Contact
          </h2>
          <ul className="flex flex-col gap-3">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              Handmade in India · shipping pan India
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex gap-2.5 hover:text-white">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1200px] px-4 py-6 text-center text-xs">
          © {new Date().getFullYear()} Hooks &amp; Threads. Every piece crocheted by hand.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; to: string; external?: boolean }[] }) {
  return (
    <div>
      <h2 className="relative mb-5 pb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white after:absolute after:bottom-0 after:left-0 after:h-px after:w-14 after:bg-anon-pink">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a href={l.to} target="_blank" rel="noreferrer" className="hover:text-white">
                {l.label}
              </a>
            ) : (
              <Link to={l.to} className="hover:text-white">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
