import { MessageCircle, Package, Palette } from "lucide-react";

import { GradientButton } from "@/components/gradient-button";
import { Button } from "@/components/ui/button";
import { INSTAGRAM_URL } from "@/data/site-data";

const bullets = [
  { icon: Palette, text: "Choose your pieces and pick your colours" },
  { icon: MessageCircle, text: "Message us the product, quantity, and colours" },
  { icon: Package, text: "Receive it wrapped and ready in 1-2 weeks" },
];

export function WeightLossSection() {
  return (
    <section id="how-to-order" className="bg-background py-20">
      <div className="container grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
            Three simple steps to your dream piece.
          </h2>

          <div className="mt-8 flex flex-col gap-4">
            {bullets.map((bullet) => (
              <div key={bullet.text} className="flex items-center gap-3">
                <bullet.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                <span className="text-base">{bullet.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <a href="#products">Browse catalogue</a>
            </Button>
            <GradientButton
              as="a"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Send a reference
            </GradientButton>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Every order is made by hand in the colours you pick. Dispatch
            usually takes 7-14 days depending on the size of your order.
          </p>
        </div>

        <img
          src="/images/how-to-order.jpg"
          alt="Handmade crochet piece"
          className="w-full rounded-2xl object-cover"
        />
      </div>
    </section>
  );
}
