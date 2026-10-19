import { useEffect, useState } from "react";
import {
  ChevronDown,
  Grid2x2,
  Heart,
  Home,
  LogOut,
  MapPin,
  Menu,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { INSTAGRAM_URL, type Category } from "@/data/site-data";
import { cn } from "@/lib/utils";

/** The categories that get their own link in the desktop menu, in order. */
const MENU_CATEGORIES = ["forever-flowers", "keychains", "hair-accessories", "festive", "home-decor"];

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-anon-pink px-1 text-[10px] font-medium leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function StoreHeader({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const { itemCount } = useCart();
  const { handles } = useWishlist();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<"menu" | "categories" | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setDrawer(null);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const byslug = new Map(categories.map((c) => [c.slug, c]));
  const menuCategories = MENU_CATEGORIES.map((slug) => byslug.get(slug)).filter((c): c is Category => Boolean(c));

  return (
    <header className="font-poppins">
      {/* Top bar */}
      <div className="hidden border-b border-anon-cultured md:block">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-2.5 text-xs">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Hooks & Threads on Instagram"
            className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-anon-cultured text-anon-gray transition-colors hover:bg-anon-pink hover:text-white"
          >
            <InstagramIcon className="h-3.5 w-3.5" />
          </a>
          <p className="uppercase tracking-wide text-anon-gray">
            <span className="font-semibold text-anon-onyx">Handmade to order</span> · shipping across India
          </p>
          <Link to="/contact" className="uppercase tracking-wide text-anon-gray hover:text-anon-pink">
            Custom orders
          </Link>
        </div>
      </div>

      {/* Logo, search, icons */}
      <div className="border-b border-anon-cultured">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-4 px-4 py-5 md:flex-nowrap">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Hooks & Threads home">
            <img src="/images/logo-icon.png" alt="" className="h-10 w-10" />
            <span className="font-brand text-lg font-semibold tracking-[0.12em] text-anon-black sm:text-xl">
              HOOKS &amp; THREADS
            </span>
          </Link>

          <form onSubmit={search} className="relative order-last w-full md:order-none md:flex-1" role="search">
            <label htmlFor="store-search" className="sr-only">
              Search the shop
            </label>
            <input
              id="store-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flowers, keychains, hair clips…"
              className="w-full rounded-[10px] border border-anon-cultured py-2.5 pl-4 pr-11 text-sm text-anon-black placeholder:text-anon-silver focus:border-anon-silver focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-anon-onyx hover:text-anon-pink"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          </form>

          <div className="ml-auto hidden items-center gap-5 md:flex">
            <div className="relative">
              <button
                type="button"
                onClick={() => (user ? setAccountOpen((v) => !v) : navigate("/login"))}
                aria-label={user ? "Your account" : "Sign in"}
                aria-expanded={user ? accountOpen : undefined}
                className="flex text-anon-black hover:text-anon-pink"
              >
                <User className="h-[26px] w-[26px]" strokeWidth={1.6} />
              </button>
              {user && accountOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-56 rounded-[10px] border border-anon-cultured bg-white p-2 text-sm shadow-lg">
                  <p className="truncate px-3 py-2 font-medium text-anon-black">{user.full_name}</p>
                  <AccountLink to="/account/orders" icon={<Package className="h-4 w-4" />}>
                    My orders
                  </AccountLink>
                  <AccountLink to="/account/addresses" icon={<MapPin className="h-4 w-4" />}>
                    Addresses
                  </AccountLink>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-anon-gray hover:bg-anon-cultured hover:text-anon-black"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
            <Link to="/wishlist" aria-label={`Wishlist, ${handles.length} items`} className="relative text-anon-black hover:text-anon-pink">
              <Heart className="h-[26px] w-[26px]" strokeWidth={1.6} />
              <CountBadge count={handles.length} />
            </Link>
            <Link to="/cart" aria-label={`Cart, ${itemCount} items`} className="relative text-anon-black hover:text-anon-pink">
              <ShoppingBag className="h-[26px] w-[26px]" strokeWidth={1.6} />
              <CountBadge count={itemCount} />
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop menu */}
      <nav aria-label="Shop" className="relative hidden border-b border-anon-cultured lg:block">
        <ul className="mx-auto flex max-w-[1200px] items-center justify-center gap-9 px-4 text-[13px] font-semibold uppercase text-anon-onyx">
          <li>
            <MenuLink to="/">Home</MenuLink>
          </li>
          <li className="group/mega static">
            <button type="button" className="relative flex items-center gap-1 py-4 uppercase hover:text-anon-pink">
              Categories <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div className="invisible absolute left-0 right-0 z-40 translate-y-2 opacity-0 transition-all duration-200 group-hover/mega:visible group-hover/mega:translate-y-0 group-hover/mega:opacity-100 group-focus-within/mega:visible group-focus-within/mega:translate-y-0 group-focus-within/mega:opacity-100">
              <div className="mx-auto max-w-[1200px] px-4">
                <div className="grid grid-cols-4 gap-x-8 gap-y-1 rounded-[10px] border border-anon-cultured bg-white p-7 normal-case shadow-[0_3px_5px_hsla(0,0%,0%,0.1)]">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/category/${c.slug}`}
                      className="flex items-center justify-between rounded-md px-2 py-2 text-sm font-normal text-anon-gray hover:bg-anon-cultured/60 hover:text-anon-pink"
                    >
                      {c.name}
                      <span className="text-xs text-anon-silver">{counts[c.slug] ?? 0}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </li>
          {menuCategories.map((c) => (
            <li key={c.slug}>
              <MenuLink to={`/category/${c.slug}`}>{c.name}</MenuLink>
            </li>
          ))}
          <li>
            <MenuLink to="/products">Shop all</MenuLink>
          </li>
        </ul>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Quick links"
        className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[500px] -translate-x-1/2 items-center justify-around rounded-t-[10px] bg-white px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_0_10px_hsla(0,0%,0%,0.25)] lg:hidden"
      >
        <BottomButton label="Menu" onClick={() => setDrawer("menu")}>
          <Menu className="h-6 w-6" />
        </BottomButton>
        <BottomLink label="Cart" to="/cart" count={itemCount}>
          <ShoppingBag className="h-6 w-6" />
        </BottomLink>
        <BottomLink label="Home" to="/">
          <Home className="h-6 w-6" />
        </BottomLink>
        <BottomLink label="Wishlist" to="/wishlist" count={handles.length}>
          <Heart className="h-6 w-6" />
        </BottomLink>
        <BottomButton label="Categories" onClick={() => setDrawer("categories")}>
          <Grid2x2 className="h-6 w-6" />
        </BottomButton>
      </nav>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity lg:hidden",
          drawer ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setDrawer(null)}
        aria-hidden
      />
      <aside
        aria-label={drawer === "categories" ? "Categories" : "Menu"}
        aria-hidden={!drawer}
        inert={!drawer}
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex w-full max-w-[320px] flex-col overflow-y-auto bg-white p-5 shadow-xl transition-transform duration-300 lg:hidden",
          drawer ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between border-b border-anon-cultured pb-4">
          <h2 className="text-base font-semibold uppercase tracking-wide text-anon-pink">
            {drawer === "categories" ? "Categories" : "Menu"}
          </h2>
          <button type="button" onClick={() => setDrawer(null)} aria-label="Close" className="text-anon-black">
            <X className="h-6 w-6" />
          </button>
        </div>
        {drawer === "categories" ? (
          <ul className="flex flex-col">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/category/${c.slug}`}
                  className="flex items-center justify-between border-b border-anon-cultured/70 py-3 text-sm text-anon-onyx hover:text-anon-pink"
                >
                  <span className="flex items-center gap-3">
                    <img src={c.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                    {c.name}
                  </span>
                  <span className="text-xs text-anon-silver">{counts[c.slug] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <DrawerMenu categories={menuCategories} user={Boolean(user)} onLogout={logout} />
        )}
      </aside>
    </header>
  );
}

function MenuLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="relative block py-4 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-anon-pink after:transition-transform hover:text-anon-pink hover:after:scale-x-100"
    >
      {children}
    </Link>
  );
}

function AccountLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-anon-gray hover:bg-anon-cultured hover:text-anon-black">
      {icon}
      {children}
    </Link>
  );
}

function BottomLink({ label, to, count = 0, children }: { label: string; to: string; count?: number; children: React.ReactNode }) {
  return (
    <Link to={to} aria-label={label} className="relative p-2 text-anon-black">
      {children}
      <CountBadge count={count} />
    </Link>
  );
}

function BottomButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="p-2 text-anon-black">
      {children}
    </button>
  );
}

function DrawerMenu({ categories, user, onLogout }: { categories: Category[]; user: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const row = "flex items-center justify-between border-b border-anon-cultured/70 py-3 text-[15px] font-medium text-anon-black hover:text-anon-pink";
  return (
    <ul className="flex flex-col">
      <li>
        <Link to="/" className={row}>Home</Link>
      </li>
      <li>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn(row, "w-full")}>
          Popular categories {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
        {open && (
          <ul className="py-1 pl-2">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="block py-2 text-sm text-anon-gray hover:text-anon-pink">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
      <li>
        <Link to="/products" className={row}>Shop all</Link>
      </li>
      <li>
        <Link to="/contact" className={row}>Custom orders</Link>
      </li>
      {user ? (
        <>
          <li>
            <Link to="/account/orders" className={row}>My orders</Link>
          </li>
          <li>
            <button type="button" onClick={onLogout} className={cn(row, "w-full")}>Sign out</button>
          </li>
        </>
      ) : (
        <li>
          <Link to="/login" className={row}>Sign in</Link>
        </li>
      )}
      <li className="mt-6 flex items-center gap-3 text-xs text-anon-gray">
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-anon-pink">
          <InstagramIcon className="h-4 w-4" /> @hooksnthreads_official
        </a>
      </li>
    </ul>
  );
}
