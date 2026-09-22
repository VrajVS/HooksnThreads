import type { ReactNode } from "react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-brand text-4xl font-semibold md:text-5xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {updated}
          </p>
          <div className="prose-legal mt-10 flex flex-col gap-6 text-base leading-relaxed text-foreground">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
