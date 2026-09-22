import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container flex flex-col items-center gap-4 py-32 text-center">
        <Compass className="h-14 w-14 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="font-brand text-4xl font-semibold">Page not found</h1>
        <p className="max-w-md text-muted-foreground">
          The page you're looking for doesn't exist, or may have moved. Let's
          get you back to the catalogue.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link to="/">Back to Home</Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
