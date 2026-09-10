import path from "node:path";
import type { NextConfig } from "next";

/*
 * Security headers — the BASELINE, for pages src/proxy.ts does not cover.
 *
 * Read src/proxy.ts first. That is where the real Content-Security-Policy
 * lives: a per-request nonce with 'strict-dynamic', applied to every route
 * that takes user input or handles money. What is left here is the weaker
 * policy the static marketing and policy pages fall back to.
 *
 * WHY THE SPLIT, since a nonce everywhere would plainly be better: a nonce is
 * per-request, so a page that carries one cannot be prerendered — Next's own
 * CSP guide says as much. Applying it site-wide would throw away the
 * revalidate=300 edge cache on the home page, which is the page that decides
 * whether a phone arriving from Instagram on a slow connection stays.
 *
 * That trade turned out to be free, because the split falls exactly where the
 * risk does. Every page that touches a customer — /shop, the PDP, /cart,
 * /checkout, /track, /wishlist, /contact, /order/[token] — is ALREADY dynamic
 * for its own reasons, so nonces cost it nothing. What stays static is /,
 * /about, /size-guide and /policies/*: marketing and legal copy with no user
 * input, nothing echoed back, and no form.
 *
 * So the honest statement of coverage is: script-src protects 100% of the
 * pages where an injection could reach a customer, and 0% of the pages where
 * there is nothing to inject. If a static page ever grows a form or renders
 * anything a stranger typed, ADD IT TO THE MATCHER IN src/proxy.ts — that is
 * the whole maintenance burden of this design.
 *
 * The directives below need no nonce and are cache-safe, so they apply
 * everywhere, including under the strict policy:
 *
 *   frame-ancestors 'none'  — the modern, stronger X-Frame-Options; nothing
 *                             can iframe the shop, so an attacker cannot
 *                             overlay an invisible checkout and harvest clicks
 *   object-src 'none'       — no Flash/applet/embed vector
 *   base-uri 'self'         — stops an injected <base> silently repointing
 *                             every relative URL on the page
 *   form-action 'self'      — an injected form cannot post the checkout
 *                             somewhere else
 *   upgrade-insecure-requests — no mixed content
 *
 * Proof both halves work: apps/store/scripts/csp-test.mjs asserts the strict
 * pages block an injected inline handler, the static ones are honestly
 * unprotected, and — the part that matters most — that nothing is broken by
 * either policy.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    /*
     * NOTE the absence of default-src HERE, and do not "tidy" it back in.
     *
     * `default-src 'self'` looks like the safe baseline and is the opposite
     * of it in this position: script-src and style-src INHERIT from it, so on
     * a page with no script-src of its own it silently bans every inline
     * script and inline style. Next's hydration bootstrap is an inline
     * script, so React never mounts — no cart, no wishlist, no search — and
     * every style={{...}} is dropped. Measured: 205 violations and a dead
     * page, while the header itself looked perfectly correct in curl. It
     * shipped once, exactly like that, and reading the header is what fooled
     * me; only loading the page in a browser catches it.
     *
     * src/proxy.ts DOES send default-src 'self', and that is safe there for
     * the one reason that matters: it also sends an explicit script-src and
     * style-src, so nothing is left to inherit the ban.
     *
     * Weakening this to 'unsafe-inline' instead would leave a script-src that
     * stops nothing, which is worse than honest silence — it reads as
     * protection in an audit and provides none.
     */
    value: [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  /* For browsers predating frame-ancestors. Same intent, older spelling. */
  { key: "X-Frame-Options", value: "DENY" },
  /* Stops a browser second-guessing Content-Type and executing an upload as
     script. */
  { key: "X-Content-Type-Options", value: "nosniff" },
  /* Send the origin cross-site, the full path same-site. Without this, the
     full URL of a page a customer was on leaks to every outbound link —
     including order URLs, which carry an unguessable token. */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /* Nothing here needs a camera, a microphone or a location. */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  /*
   * Two years, subdomains included. Cloudflare terminates TLS, but HSTS is
   * what stops the FIRST request of a session going out over plain http and
   * being intercepted on a cafe network — which for a checkout carrying a
   * phone number and an address is the whole point.
   */
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  /* Do not advertise the framework and its version to an attacker. */
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  /*
   * This app lives in a workspace, and file tracing defaults to the app's own
   * directory — so anything it imports from packages/shared would be left out
   * of the build. That matters here because the deploy target is Cloudflare
   * Workers via OpenNext, which packages exactly what tracing found.
   *
   * Turbopack transpiles workspace packages on its own, so `transpilePackages`
   * is deliberately NOT set.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
