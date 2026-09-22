import * as React from "react";
import { toast } from "sonner";

const STORAGE_KEY = "hnt-compare";
const MAX = 4;

interface CompareContextValue {
  handles: string[];
  isSelected: (handle: string) => boolean;
  toggle: (handle: string) => void;
  clear: () => void;
  max: number;
}

const CompareContext = React.createContext<CompareContextValue | null>(null);

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [handles, setHandles] = React.useState<string[]>(() => read());

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
    } catch {
      /* ignore */
    }
  }, [handles]);

  const isSelected = React.useCallback(
    (h: string) => handles.includes(h),
    [handles],
  );

  const toggle = React.useCallback((h: string) => {
    setHandles((prev) => {
      if (prev.includes(h)) return prev.filter((x) => x !== h);
      if (prev.length >= MAX) {
        toast.error(`You can compare up to ${MAX} pieces at once.`);
        return prev;
      }
      return [...prev, h];
    });
  }, []);

  const clear = React.useCallback(() => setHandles([]), []);

  const value = React.useMemo(
    () => ({ handles, isSelected, toggle, clear, max: MAX }),
    [handles, isSelected, toggle, clear],
  );

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = React.useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
