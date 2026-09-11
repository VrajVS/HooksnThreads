import { SmartLink } from "@/components/smart-link";
import { INSTAGRAM_URL, footerLinks } from "@/data/site-data";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.5.5.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.76 4.9 4.9 0 0 1-1.76 1.15c-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.76-1.15 4.9 4.9 0 0 1-1.15-1.76c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76A4.9 4.9 0 0 1 5.44 2.53c.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.87.04-1.34.18-1.65.3-.42.16-.71.36-1.02.67-.31.31-.5.6-.67 1.02-.12.31-.26.78-.3 1.65C4.27 8.55 4.26 8.87 4.26 12s.01 3.45.06 4.5c.04.87.18 1.34.3 1.65.16.42.36.71.67 1.02.31.31.6.5 1.02.67.31.12.78.26 1.65.3 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.87-.04 1.34-.18 1.65-.3.42-.16.71-.36 1.02-.67.31-.31.5-.6.67-1.02.12-.31.26-.78.3-1.65.05-1.05.06-1.37.06-4.5s-.01-3.45-.06-4.5c-.04-.87-.18-1.34-.3-1.65a2.7 2.7 0 0 0-.67-1.02 2.7 2.7 0 0 0-1.02-.67c-.31-.12-.78-.26-1.65-.3-1.05-.05-1.37-.06-4.04-.06Zm0 3.5a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 1.8a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm4.89-2.02a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z" />
    </svg>
  );
}

const socialIcons = [{ Icon: InstagramIcon, label: "Instagram", href: INSTAGRAM_URL }];

export function Footer() {
  return (
    <footer className="bg-zinc-900 py-16 text-white">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <img
              src="/images/logo-inverted.png"
              alt="Hooks &amp; Threads"
              className="h-14 w-auto object-contain"
            />
            <p className="mt-4 max-w-sm text-sm text-white/70">
              Get the latest on new collections and catalogue drops delivered
              to your inbox.
            </p>
            <form
              className="mt-6 flex max-w-md gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                required
                placeholder="Enter your email"
                className="w-full rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/40"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-white/90"
              >
                Sign up
              </button>
            </form>
            <p className="mt-4 text-xs text-white/50">
              By signing up, you agree to our Privacy Policy and consent to
              receive marketing emails.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <p className="text-sm font-semibold">{heading}</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <SmartLink
                        href={link.href}
                        className="text-sm text-white/70 transition-colors hover:text-white"
                      >
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="flex items-center gap-5">
              {socialIcons.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-white/70 transition-colors hover:text-white"
                >
                  <Icon />
                </a>
              ))}
            </div>

            <div className="flex items-center gap-6">
              <div className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold">
                100% Handcrafted
              </div>
              <div className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold">
                Made in India
              </div>
            </div>
          </div>

          <p className="mt-8 max-w-4xl text-xs leading-relaxed text-white/50">
            Every piece is handmade to order, so slight variations in
            colour, size, and finish may occur — that's the nature of
            handcrafted work. Orders ship pan India once your piece is
            ready, usually within 7-14 days.
          </p>
        </div>
      </div>
    </footer>
  );
}
