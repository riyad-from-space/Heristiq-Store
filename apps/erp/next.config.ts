import path from "node:path";
import type { NextConfig } from "next";

/*
 * The ERP is served under /admin, not on its own hostname.
 *
 * The owner reaches this from the website — heristiq.com/admin — rather than
 * remembering a workers.dev URL. Two Workers serve one domain: Cloudflare
 * routes /admin* here and everything else to the storefront, and basePath is
 * what makes this app agree with that. Next prefixes every next/link,
 * redirect() and router.push() automatically, so no page or action changed.
 *
 * basePath is inlined into the client bundle at BUILD time, so it cannot be
 * switched per environment at runtime. It is env-driven only so a deployment
 * that wants the ERP on its own hostname can build with
 * ERP_BASE_PATH= (empty).
 */
const basePath = process.env.ERP_BASE_PATH ?? "/admin";

/*
 * Security headers — the baseline. The real policy is in src/proxy.ts.
 *
 * Unlike the storefront, the ERP has no split to reason about: every page
 * here is behind authentication and therefore already dynamic, so the
 * nonce-based Content-Security-Policy in src/proxy.ts covers the entire app
 * at no cost. There is no cached page to protect and no anonymous page to
 * leave behind.
 *
 * What remains here applies alongside it, and matters most for the requests
 * the proxy matcher deliberately skips (Next's own static output):
 *
 *   frame-ancestors 'none'  — the modern, stronger X-Frame-Options; nothing
 *                             can iframe the admin panel, so an attacker
 *                             cannot overlay it and harvest an owner's clicks
 *   object-src 'none'       — no Flash/applet/embed vector
 *   base-uri 'self'         — stops an injected <base> silently repointing
 *                             every relative URL on the page
 *   form-action 'self'      — an injected form cannot post admin input
 *                             somewhere else
 *   upgrade-insecure-requests — no mixed content
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    /*
     * NOTE the absence of default-src HERE, and do not "tidy" it back in.
     *
     * `default-src 'self'` looks like the safe baseline and is the opposite
     * of it in this position: script-src and style-src INHERIT from it, so on
     * a response with no script-src of its own it silently bans every inline
     * script and inline style. Next's hydration bootstrap is an inline
     * script, so React never mounts. Measured on the storefront: 205
     * violations and a dead page, while the header itself looked perfectly
     * correct in curl — reading the header is what fooled me; only loading
     * the page in a browser catches it.
     *
     * src/proxy.ts DOES send default-src 'self', and that is safe there
     * because it also sends an explicit script-src and style-src, so nothing
     * is left to inherit the ban.
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

  ...(basePath && { basePath }),

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
