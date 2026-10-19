import { ProductGrid } from "@/components/product-grid";
import { useProducts } from "@/hooks/use-products";

export function ProductsSection() {
  const { products, loading } = useProducts();
  const featuredProducts = products.filter((product) => product.featured);

  return (
    <section id="products" className="container py-10 md:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Our Catalogue
        </p>
        <h2 className="display mt-3 text-4xl md:text-5xl lg:text-6xl">
          Handcrafted Pieces <em>Made Just For You</em>
        </h2>
      </div>

      <div className="mt-8">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
          <ProductGrid
            products={featuredProducts}
            className="grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-3 xl:grid-cols-6"
          />
        )}
      </div>
    </section>
  );
}
