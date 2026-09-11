import * as React from "react";

const STORAGE_KEY = "hnt-wishlist";

interface WishlistContextValue {
  handles: string[];
  isWishlisted: (handle: string) => boolean;
  toggleWishlist: (handle: string) => void;
}

const WishlistContext = React.createContext<WishlistContextValue | null>(null);

function readStoredWishlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [handles, setHandles] = React.useState<string[]>(() => readStoredWishlist());

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
  }, [handles]);

  const isWishlisted = React.useCallback(
    (handle: string) => handles.includes(handle),
    [handles],
  );

  const toggleWishlist = React.useCallback((handle: string) => {
    setHandles((prev) =>
      prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle],
    );
  }, []);

  const value = React.useMemo(
    () => ({ handles, isWishlisted, toggleWishlist }),
    [handles, isWishlisted, toggleWishlist],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = React.useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
