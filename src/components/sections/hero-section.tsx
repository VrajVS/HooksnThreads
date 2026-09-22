import { ArrowRight, Heart, Palette, Star, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { INSTAGRAM_URL, marqueeColumnA, marqueeColumnB } from "@/data/site-data";

const features = [
  { icon: Heart, text: "100% handcrafted, one stitch at a time" },
  { icon: Palette, text: "Fully customizable in your favourite colours" },
  { icon: Truck, text: "Shipped pan India, wrapped and ready" },
];

function MarqueeColumn({
  images,
  reverse,
}: {
  images: string[];
  reverse?: boolean;
}) {
  const doubled = [...images, ...images];
  return (
    <div className="relative h-full overflow-hidden rounded-2xl">
      <div
        className={
          reverse
            ? "flex flex-col gap-4 animate-marquee-reverse"
            : "flex flex-col gap-4 animate-marquee"
        }
      >
        {doubled.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="h-64 w-full rounded-2xl object-cover"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="container pb-16 pt-6 md:pb-24 md:pt-8">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col justify-center lg:justify-start">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
              <Star className="h-3.5 w-3.5 fill-white text-white" />
            </span>
            <span className="text-sm font-medium">
              100% Handcrafted &bull; 130+ Pieces Made
            </span>
          </div>

          <h1 className="font-brand text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
            Handmade Elegance, Stitch by Stitch
          </h1>

          <div className="mt-8 flex flex-col gap-4">
            {features.map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <feature.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                <span className="text-base">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="my-8 border-t border-border" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-3xl font-bold">From ₹180/piece</p>
              <p className="text-sm text-muted-foreground">
                *Fully customizable in your colours
              </p>
            </div>
            <Button asChild size="lg">
              <a href="#products">Browse Catalogue</a>
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-4 rounded-3xl bg-white p-4 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
            <img
              src="/images/hero-custom-thumb.jpg"
              alt=""
              className="h-16 w-16 rounded-2xl object-cover"
            />
            <div className="flex flex-1 items-center justify-between">
              <p className="font-semibold">Have Something Specific in Mind?</p>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-medium hover:opacity-60"
              >
                Send a reference
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
          <div className="h-[40rem]">
            <MarqueeColumn images={marqueeColumnA} />
          </div>
          <div className="h-[40rem] pt-16">
            <MarqueeColumn images={marqueeColumnB} reverse />
          </div>
        </div>
      </div>
    </section>
  );
}
