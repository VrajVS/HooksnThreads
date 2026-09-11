import { useSearchParams } from "react-router-dom";
import { SearchX } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductGrid } from "@/components/product-grid";
import { useProducts } from "@/hooks/use-products";

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const { products: results, loading } = useProducts({ search: query || undefined });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-16">
        <h1 className="text-3xl font-semibold md:text-4xl">
          {query ? (
            <>
              Search results for &ldquo;{query}&rdquo;
            </>
          ) : (
            "Search"
          )}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {results.length} piece{results.length === 1 ? "" : "s"} found
        </p>

        {loading ? (
          <p className="mt-12 text-center text-muted-foreground">Loading...</p>
        ) : results.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
            <SearchX className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-lg font-medium">
              {query ? "No pieces matched your search" : "Try searching for a product"}
            </p>
          </div>
        ) : (
          <div className="mt-12">
            <ProductGrid products={results} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
