import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ProductGrid } from "@/components/product-grid";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/context/wishlist-context";
import { useProducts } from "@/hooks/use-products";

export function WishlistPage() {
  const { handles } = useWishlist();
  const { products, loading } = useProducts();
  const wishlistedProducts = products.filter((p) => handles.includes(p.handle));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-16">
        <h1 className="font-brand text-4xl font-semibold md:text-5xl">Your Wishlist</h1>

        {loading ? (
          <p className="mt-12 text-center text-muted-foreground">Loading...</p>
        ) : wishlistedProducts.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
            <Heart className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-lg font-medium">Your wishlist is empty</p>
            <Button asChild size="lg" className="mt-2">
              <Link to="/#products">Browse Catalogue</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-12">
            <ProductGrid products={wishlistedProducts} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
