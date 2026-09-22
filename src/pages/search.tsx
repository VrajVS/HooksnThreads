import { useSearchParams } from "react-router-dom";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductListing } from "@/components/product-listing";
import { useProducts } from "@/hooks/use-products";

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const { products, loading } = useProducts({ search: query || undefined });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <ProductListing
          title={query ? `Search results for “${query}”` : "Search"}
          subtitle={
            query
              ? "Refine the results further using the filters."
              : "Type in the search bar above to find a piece."
          }
          products={products}
          loading={loading}
          emptyLabel={
            query
              ? "No pieces matched your search"
              : "Try searching for a product name"
          }
        />
      </main>
      <Footer />
    </div>
  );
}
