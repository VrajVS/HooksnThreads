import { useState } from "react";
import { Mail, MessageCircle } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/gradient-button";
import { INSTAGRAM_URL } from "@/data/site-data";

const CONTACT_EMAIL = "hello@hooksnthreads.shop";

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Message from ${name || "the website"}`,
  )}&body=${encodeURIComponent(`${message}\n\n— ${name} (${email})`)}`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-16">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-4xl font-semibold md:text-5xl">Get in Touch</h1>
          <p className="mt-4 text-muted-foreground">
            Questions about an order, a custom piece, or anything else? Reach
            out and we'll get back to you.
          </p>
        </div>

        <form
          className="mx-auto mt-12 flex max-w-xl flex-col gap-4 rounded-3xl bg-white p-8 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="message" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Button asChild size="lg" className="mt-2">
            <a href={mailtoHref}>
              <Mail className="h-4 w-4" />
              Send Message
            </a>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            This opens your email app with the message pre-filled. Prefer
            Instagram?
          </p>
          <GradientButton
            as="a"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <MessageCircle className="h-4 w-4" />
            DM us on Instagram
          </GradientButton>
        </form>
      </main>
      <Footer />
    </div>
  );
}
