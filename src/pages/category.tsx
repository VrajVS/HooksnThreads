import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductGrid } from "@/components/product-grid";
import { useCategory } from "@/hooks/use-category";
import { useProducts } from "@/hooks/use-products";

export function CategoryPage() {
  const { slug } = useParams();
  const { category, loading: categoryLoading, notFound } = useCategory(slug);
  const { products: categoryProducts, loading: productsLoading } = useProducts({ category: slug });

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container flex flex-col items-center gap-4 py-32 text-center">
          <h1 className="font-brand text-3xl font-semibold">Category not found</h1>
          <Link to="/" className="text-sm font-medium underline">
            Back to home
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (categoryLoading || !category) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-32 text-center text-muted-foreground">Loading...</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="container py-16">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to home
          </Link>

          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h1 className="font-brand text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
                {category.name}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                {category.tagline}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {categoryProducts.length} piece
                {categoryProducts.length === 1 ? "" : "s"} in this collection
              </p>
            </div>
            <img
              src={category.image}
              alt={category.name}
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg"
            />
          </div>
        </section>

        <section id="products" className="container pb-20">
          {productsLoading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : (
            <ProductGrid products={categoryProducts} />
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
