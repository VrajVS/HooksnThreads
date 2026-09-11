import { LegalPage } from "@/components/legal-page";

export function ShippingPolicyPage() {
  return (
    <LegalPage title="Shipping & Delivery Policy" updated="30 August 2026">
      <p>
        Here's what to expect once you've placed an order with Hooks &amp;
        Threads.
      </p>

      <div>
        <h2 className="text-xl font-semibold">Making time</h2>
        <p className="mt-2 text-muted-foreground">
          Every piece is made fresh once you order — nothing sits in
          inventory. Depending on the size and complexity of your order,
          making time is typically 7-14 days before your order is dispatched.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Shipping</h2>
        <p className="mt-2 text-muted-foreground">
          We ship pan India via trusted courier partners. Once your order is
          dispatched, delivery typically takes an additional 2-7 business
          days depending on your location. You'll receive a tracking update
          once your order has shipped.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Shipping charges</h2>
        <p className="mt-2 text-muted-foreground">
          Shipping charges, if any, are calculated at checkout based on your
          order weight and delivery location.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Delays</h2>
        <p className="mt-2 text-muted-foreground">
          Occasionally, factors outside our control — festive seasons,
          courier delays, or weather — can extend delivery times. We'll keep
          you updated if your order is expected to take longer than usual.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Contact us</h2>
        <p className="mt-2 text-muted-foreground">
          Questions about your shipment can be sent via our{" "}
          <a href="/contact" className="underline underline-offset-2">
            contact page
          </a>
          .
        </p>
      </div>
    </LegalPage>
  );
}
