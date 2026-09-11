import { LegalPage } from "@/components/legal-page";

export function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" updated="30 August 2026">
      <p>
        These terms govern your use of the Hooks &amp; Threads website and
        any orders placed with us. By placing an order, you agree to these
        terms.
      </p>

      <div>
        <h2 className="text-xl font-semibold">Handmade, made-to-order goods</h2>
        <p className="mt-2 text-muted-foreground">
          Every piece is handmade to order. Because each item is crocheted by
          hand, small variations in colour, size, and finish compared to the
          product photos are normal and are not considered defects. Colours
          may also vary slightly depending on your screen and on yarn dye
          lots.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Pricing and availability</h2>
        <p className="mt-2 text-muted-foreground">
          Prices are listed in Indian Rupees (₹) and may change without prior
          notice; the price at the time your order is confirmed and paid for
          is the price that applies. We reserve the right to limit order
          quantities and to decline an order at our discretion.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Order confirmation</h2>
        <p className="mt-2 text-muted-foreground">
          An order is only confirmed once payment has been successfully
          processed. You will receive an order confirmation with your order
          details once this happens.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Intellectual property</h2>
        <p className="mt-2 text-muted-foreground">
          All designs, photography, and content on this site belong to Hooks
          &amp; Threads and may not be reproduced without permission.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Changes to these terms</h2>
        <p className="mt-2 text-muted-foreground">
          We may update these terms from time to time. Continued use of the
          site after changes are posted means you accept the updated terms.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Contact us</h2>
        <p className="mt-2 text-muted-foreground">
          Questions about these terms can be sent via our{" "}
          <a href="/contact" className="underline underline-offset-2">
            contact page
          </a>
          .
        </p>
      </div>
    </LegalPage>
  );
}
