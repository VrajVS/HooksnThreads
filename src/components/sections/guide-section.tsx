import { ChevronRight } from "lucide-react";

import { GradientButton } from "@/components/gradient-button";
import { SmartLink } from "@/components/smart-link";
import { Button } from "@/components/ui/button";
import { INSTAGRAM_URL, guides } from "@/data/site-data";

export function GuideSection() {
  return (
    <section className="bg-background py-28">
      <div className="container">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-3xl font-semibold md:text-4xl lg:text-5xl">
            Your guide to the Hooks &amp; Threads catalogue.
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
              Send a reference
            </GradientButton>
          </div>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => (
            <div
              key={guide.category}
              className="flex flex-col gap-4 rounded-3xl bg-white p-4"
            >
              <img
                src={guide.image}
                alt={guide.category}
                className="h-48 w-full rounded-3xl object-cover"
              />
              <p className="text-sm text-muted-foreground">
                {guide.description}
              </p>
              <SmartLink
                href={guide.href}
                className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border-2 border-zinc-900/[0.13] px-5 py-2 text-sm font-medium transition-colors hover:bg-zinc-900/[0.03]"
              >
                {guide.category}
                <ChevronRight className="h-4 w-4" />
              </SmartLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
