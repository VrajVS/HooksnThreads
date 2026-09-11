import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { GradientButton } from "@/components/gradient-button";
import { carouselCards, type CarouselCard } from "@/data/site-data";

function CarouselCardTile({ card }: { card: CarouselCard }) {
  return (
    <div className="group relative h-[32rem] shrink-0 overflow-hidden rounded-3xl sm:h-[40rem] md:h-[48rem]">
      <img
        src={card.image}
        alt={card.title}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-8 text-white">
        <div>
          <p className="text-sm opacity-80">{card.priceLabel}</p>
          <p className="text-2xl font-bold">{card.price}</p>
          <p className="text-lg font-semibold">{card.title}</p>
        </div>
        <GradientButton
          as={Link}
          to={card.href}
          innerClassName="bg-white text-foreground"
        >
          Browse Collection
        </GradientButton>
      </div>
    </div>
  );
}

export function CarouselSection() {
  const [index, setIndex] = useState(0);
  const count = carouselCards.length;

  const goTo = (i: number) => setIndex((i + count) % count);

  return (
    <section className="bg-[hsl(37,20%,85%)] py-20">
      <div className="container grid gap-8 lg:grid-cols-2">
        <CarouselCardTile card={carouselCards[0]} />

        <div className="relative">
          <div className="overflow-hidden rounded-3xl">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {carouselCards.map((card) => (
                <div key={card.title} className="w-full shrink-0">
                  <CarouselCardTile card={card} />
                </div>
              ))}
            </div>
          </div>

          <button
            aria-label="Previous slide"
            onClick={() => goTo(index - 1)}
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-100/80 shadow-md transition hover:bg-neutral-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next slide"
            onClick={() => goTo(index + 1)}
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-100/80 shadow-md transition hover:bg-neutral-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2">
            {carouselCards.map((card, i) => (
              <button
                key={card.title}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
