import { useEffect, useState } from "react";
import { Heart, LogOut, MapPin, Menu, MessageCircle, Package, Search, ShoppingBag, User, X } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { GradientButton } from "@/components/gradient-button";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { INSTAGRAM_URL, navLinks } from "@/data/site-data";

export function Navbar() {
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { handles } = useWishlist();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, search } = useLocation();

  // Any navigation closes the mobile menu.
  useEffect(() => setMenuOpen(false), [pathname, search]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="container flex h-20 items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link to="/" className="mr-auto flex shrink-0 items-center lg:mr-0">
          <img
            src="/images/logo.png"
            alt="Hooks &amp; Threads"
            className="h-12 w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="whitespace-nowrap text-sm font-medium transition-opacity hover:opacity-60"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <form
            onSubmit={handleSearch}
            className="hidden items-center rounded-full border border-border bg-white px-4 py-2 md:flex"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pieces..."
              className="ml-2 w-32 bg-transparent text-sm focus:outline-none lg:w-40"
            />
          </form>

          <Link
            to="/wishlist"
            aria-label="Wishlist"
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
          >
            <Heart className="h-5 w-5" />
            {handles.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {handles.length}
              </span>
            )}
          </Link>

          <Link
            to="/cart"
            aria-label="Cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {itemCount}
              </span>
            )}
          </Link>

          <GradientButton
            as="a"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            innerClassName="px-5 py-2"
            className="hidden md:inline-flex"
          >
            <MessageCircle className="h-4 w-4" />
            Custom Order
          </GradientButton>

          {user ? (
            <div className="relative">
              <button
                aria-label="Account menu"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
              >
                <User className="h-5 w-5" />
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-12 w-56 rounded-2xl bg-white p-2 shadow-[2px_4px_12px_rgba(0,0,0,0.12)]">
                  <p className="truncate px-3 py-2 text-sm font-medium">{user.full_name}</p>
                  <Link
                    to="/account/orders"
                    onClick={() => setAccountOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                  >
                    <Package className="h-4 w-4" />
                    My orders
                  </Link>
                  <Link
                    to="/account/addresses"
                    onClick={() => setAccountOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                  >
                    <MapPin className="h-4 w-4" />
                    Addresses
                  </Link>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              aria-label="Login"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
            >
              <User className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            aria-hidden
            onClick={() => setMenuOpen(false)}
            className="fixed inset-x-0 bottom-0 top-20 z-40 bg-black/20 lg:hidden"
          />
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-20 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-border bg-background shadow-[0_12px_24px_rgba(0,0,0,0.08)] lg:hidden"
          >
            <div className="container flex flex-col gap-4 py-5">
              <form
                onSubmit={handleSearch}
                role="search"
                className="flex items-center rounded-full border border-border bg-white px-4 py-2.5 md:hidden"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pieces..."
                  aria-label="Search pieces"
                  className="ml-2 w-full bg-transparent text-base focus:outline-none"
                />
              </form>

              <nav aria-label="Main" className="flex flex-col">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.label}
                    to={link.href}
                    className={({ isActive }) =>
                      [
                        "border-b border-border/60 py-3.5 font-display text-2xl transition-colors last:border-b-0",
                        isActive ? "text-brand-sage" : "text-brand-navy hover:text-brand-sage",
                      ].join(" ")
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>

              <GradientButton
                as="a"
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                innerClassName="w-full px-5 py-2.5"
                className="w-full md:hidden"
              >
                <MessageCircle className="h-4 w-4" />
                Custom Order
              </GradientButton>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
