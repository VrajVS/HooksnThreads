import { ProductGrid } from "@/components/product-grid";
import { useProducts } from "@/hooks/use-products";

export function ProductsSection() {
  const { products, loading } = useProducts();
  const featuredProducts = products.filter((product) => product.featured);

  return (
    <section id="products" className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Our Catalogue
        </p>
        <h2 className="mt-3 text-3xl font-semibold md:text-4xl lg:text-5xl">
          Handcrafted Pieces Made Just For You
        </h2>
      </div>

      <div className="mt-14">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading...</p>
        ) : (
          <ProductGrid products={featuredProducts} />
        )}
      </div>
    </section>
  );
}
