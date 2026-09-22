import { Link } from "react-router-dom";
import { GitCompare, X } from "lucide-react";

import { useCompare } from "@/context/compare-context";
import { useProducts } from "@/hooks/use-products";

export function CompareBar() {
  const { handles, toggle, clear, max } = useCompare();
  const { products } = useProducts();

  if (handles.length === 0) return null;

  const selected = handles
    .map((h) => products.find((p) => p.handle === h))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur">
      <div className="container flex flex-wrap items-center gap-3 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitCompare className="h-4 w-4" />
          Compare ({handles.length}/{max})
        </div>
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {selected.map((p) => (
            <div
              key={p.handle}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background pl-1 pr-2 py-1"
            >
              <img
                src={p.image}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
              <span className="max-w-[140px] truncate text-xs font-medium">
                {p.title}
              </span>
              <button
                aria-label={`Remove ${p.title} from compare`}
                onClick={() => toggle(p.handle)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={clear}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
        <Link
          to={`/compare?ids=${handles.join(",")}`}
          className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
        >
          View comparison
        </Link>
      </div>
    </div>
  );
}
