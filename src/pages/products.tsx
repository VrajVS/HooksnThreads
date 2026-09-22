import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductListing } from "@/components/product-listing";
import { useProducts } from "@/hooks/use-products";

export function ProductsPage() {
  const { products, loading, error } = useProducts();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <ProductListing
          title="Shop All Pieces"
          subtitle="Every stitch handmade to order. Filter by category, price, or feature to find the piece that fits."
          products={products}
          loading={loading}
          error={error}
          emptyLabel="No pieces match these filters — try widening the range."
        />
      </main>
      <Footer />
    </div>
  );
}
