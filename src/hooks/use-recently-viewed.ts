import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hnt-recently-viewed";
const MAX = 8;

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed() {
  const [handles, setHandles] = useState<string[]>(() => read());

  useEffect(() => {
    // Cross-tab sync so opening a product in a new tab reflects here on return.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setHandles(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const track = useCallback((handle: string) => {
    setHandles((prev) => {
      const next = [handle, ...prev.filter((h) => h !== handle)].slice(0, MAX);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode etc. — silently drop */
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHandles([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { handles, track, clear };
}
