/**
 * Which home page the storefront shows at "/".
 *
 * - "anon":    the new storefront, laid out after the Anon ecommerce template
 *              (src/pages/home-anon.tsx, src/components/storefront/*).
 * - "classic": the original home page (src/pages/home.tsx), untouched.
 *
 * Switch back by setting this to "classic". Both stay reachable for comparison
 * at /home/new and /home/classic.
 */
export const STOREFRONT: "anon" | "classic" = "classic";
