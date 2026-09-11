import { Atom, FlaskConical, Leaf, Rabbit, TreePine, Wheat } from "lucide-react";

import { GradientButton } from "@/components/gradient-button";
import { Button } from "@/components/ui/button";
import { INSTAGRAM_URL } from "@/data/site-data";

const badges = [
  { Icon: Rabbit, label: "100%\nHandcrafted" },
  { Icon: TreePine, label: "Soft Cotton\nYarn" },
  { Icon: Leaf, label: "Made\nTo Order" },
  { Icon: FlaskConical, label: "Custom\nColours" },
  { Icon: Atom, label: "Pan India\nShipping" },
  { Icon: Wheat, label: "Crafted\nWith Love" },
];

export function ScienceSection() {
  return (
    <section id="about" className="bg-background py-28">
      <div className="container">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-3xl font-semibold md:text-4xl lg:text-5xl">
            A small studio, made by one pair of hands.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <a href="#products">Browse catalogue</a>
            </Button>
            <GradientButton
              as="a"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              About the maker
            </GradientButton>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          {badges.map((badge) => (
            <div
              key={badge.label}
              className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]"
            >
              <badge.Icon className="h-20 w-20" strokeWidth={1.5} />
              <p className="whitespace-pre-line text-sm font-medium">
                {badge.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
