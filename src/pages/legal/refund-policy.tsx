import { LegalPage } from "@/components/legal-page";

export function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated="30 August 2026">
      <p>
        Because every piece is handmade to order specifically for you, our
        refund and cancellation policy works a little differently from
        off-the-shelf products.
      </p>

      <div>
        <h2 className="text-xl font-semibold">Cancellations</h2>
        <p className="mt-2 text-muted-foreground">
          You can cancel an order for a full refund within 24 hours of
          placing it, as long as work on your piece hasn't started yet. Once
          crocheting has begun, we're unable to offer a cancellation since the
          materials and time are already committed to your specific order.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Damaged or incorrect items</h2>
        <p className="mt-2 text-muted-foreground">
          If your order arrives damaged or if we've sent the wrong item,
          contact us within 48 hours of delivery with photos of the piece and
          its packaging, and we'll arrange a replacement or a full refund at
          no extra cost to you.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Colour and size variation</h2>
        <p className="mt-2 text-muted-foreground">
          Since each piece is handmade, small variations in colour and size
          from the product photos are expected and are not eligible for a
          refund on their own. If you have specific requirements, let us know
          before ordering so we can confirm we can meet them.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Refund processing</h2>
        <p className="mt-2 text-muted-foreground">
          Approved refunds are issued to your original payment method and
          typically reflect within 5-7 business days, depending on your bank
          or payment provider.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Contact us</h2>
        <p className="mt-2 text-muted-foreground">
          To request a cancellation or refund, reach out via our{" "}
          <a href="/contact" className="underline underline-offset-2">
            contact page
          </a>{" "}
          as soon as possible.
        </p>
      </div>
    </LegalPage>
  );
}
