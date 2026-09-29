import { useEffect, useState } from "react";

// Must match the product grid's classes: grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5.
const BREAKPOINTS: [query: string, columns: number][] = [
  ["(min-width: 1536px)", 5],
  ["(min-width: 1280px)", 4],
  ["(min-width: 768px)", 3],
];

function currentColumns() {
  if (typeof window === "undefined") return 2;
  return BREAKPOINTS.find(([q]) => window.matchMedia(q).matches)?.[1] ?? 2;
}

/** Number of columns the product grid is showing at the current screen width. */
export function useGridColumns() {
  const [columns, setColumns] = useState(currentColumns);

  useEffect(() => {
    const lists = BREAKPOINTS.map(([q]) => window.matchMedia(q));
    const update = () => setColumns(currentColumns());
    lists.forEach((l) => l.addEventListener("change", update));
    // Some environments (emulated viewports, older WebViews) skip media-query
    // change events on resize; setColumns bails out when nothing changed.
    window.addEventListener("resize", update);
    return () => {
      lists.forEach((l) => l.removeEventListener("change", update));
      window.removeEventListener("resize", update);
    };
  }, []);

  return columns;
}
