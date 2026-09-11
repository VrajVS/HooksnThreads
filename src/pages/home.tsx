import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/sections/hero-section";
import { ProductsSection } from "@/components/sections/products-section";
import { WeightLossSection } from "@/components/sections/weight-loss-section";
import { CarouselSection } from "@/components/sections/carousel-section";
import { ScienceSection } from "@/components/sections/science-section";
import { FaqSection } from "@/components/sections/faq-section";
import { GuideSection } from "@/components/sections/guide-section";

export function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <ProductsSection />
        <WeightLossSection />
        <CarouselSection />
        <ScienceSection />
        <FaqSection />
        <GuideSection />
      </main>
      <Footer />
    </div>
  );
}
