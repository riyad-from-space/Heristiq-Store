import path from "node:path";
import type { NextConfig } from "next";

/*
 * Security headers.
 *
 * Neither app sent any before this, which meant no clickjacking protection on
 * the checkout or the admin panel, no MIME-sniffing protection, and full
 * referrer leakage to every outbound link.
 *
 * WHAT IS DELIBERATELY ABSENT: a script-src Content-Security-Policy.
 *
 * A real script-src needs a per-request nonce, and Next's own guide is
 * explicit that nonces "must use dynamic rendering" — every page, every
 * request. That would destroy the revalidate=300 edge cache on the home page
 * and the prerendering of the policy pages, which is the wrong trade for a
 * shop whose traffic is phones on slow connections arriving from Instagram.
 *
 * So this ships the directives that are strong AND cache-safe:
 *   frame-ancestors 'none'  — the modern, stronger X-Frame-Options; nothing
 *                             can iframe the shop or the ERP, so an attacker
 *                             cannot overlay an invisible checkout or admin
 *                             panel and harvest clicks
 *   object-src 'none'       — no Flash/applet/embed vector
 *   base-uri 'self'         — stops an injected <base> silently repointing
 *                             every relative URL on the page
 *   form-action 'self'      — an injected form cannot post the checkout
 *                             somewhere else
 *   upgrade-insecure-requests — no mixed content
 *
 * If a nonce-based script-src is wanted later, the cost is stated above and
 * the recipe is in node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
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
