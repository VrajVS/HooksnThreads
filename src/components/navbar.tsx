import { useState } from "react";
import { Heart, LogOut, MessageCircle, Search, ShoppingBag, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex shrink-0 items-center">
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
                <div className="absolute right-0 top-12 w-48 rounded-2xl bg-white p-2 shadow-[2px_4px_12px_rgba(0,0,0,0.12)]">
                  <p className="truncate px-3 py-2 text-sm font-medium">{user.full_name}</p>
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
    </header>
  );
}
