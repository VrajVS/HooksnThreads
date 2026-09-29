import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/data/site-data";

export function FaqSection() {
  return (
    <section className="bg-background py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="display text-4xl md:text-5xl lg:text-6xl">
            Frequently asked <em>questions</em>
          </h2>
        </div>

        <Accordion
          type="single"
          collapsible
          className="mx-auto mt-14 max-w-3xl space-y-4"
        >
          {faqs.map((faq, i) => (
            <AccordionItem
              key={faq.question}
              value={`item-${i}`}
              className="rounded-3xl border-none bg-white px-14 py-8 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]"
            >
              <AccordionTrigger className="text-2xl font-semibold">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-lg text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
