import { LegalPage } from "@/components/legal-page";

export function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="30 August 2026">
      <p>
        This Privacy Policy explains how Hooks &amp; Threads ("we", "us")
        collects, uses, and protects information you share with us when you
        browse this website or place an order.
      </p>

      <div>
        <h2 className="text-xl font-semibold">Information we collect</h2>
        <p className="mt-2 text-muted-foreground">
          When you place an order, we collect your name, phone number, email
          address, and shipping address. If you create an account, we store
          your login details and order history. We do not collect payment
          card details directly — payments are processed by our payment
          gateway partner, who handles that information under their own
          security standards.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">How we use your information</h2>
        <p className="mt-2 text-muted-foreground">
          We use your information to process and ship your order, communicate
          with you about order status, respond to enquiries, and — only with
          your consent — send updates about new collections. We do not sell
          your personal information to third parties.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Sharing your information</h2>
        <p className="mt-2 text-muted-foreground">
          We share order and shipping details with courier partners solely to
          deliver your order, and payment details with our payment gateway
          solely to process your payment. We do not share your information
          for any other purpose without your consent, except where required
          by law.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Your rights</h2>
        <p className="mt-2 text-muted-foreground">
          You can request a copy of the personal information we hold about
          you, ask us to correct it, or ask us to delete your account and
          associated data (subject to what we're legally required to retain,
          such as records of completed transactions).
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Contact us</h2>
        <p className="mt-2 text-muted-foreground">
          For any privacy-related questions, reach out via our{" "}
          <a href="/contact" className="underline underline-offset-2">
            contact page
          </a>
          .
        </p>
      </div>
    </LegalPage>
  );
}
