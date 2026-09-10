import { NextResponse, type NextRequest } from "next/server";

/*
 * A strict, nonce-based Content-Security-Policy for the pages that handle
 * money and personal data.
 *
 * ---------------------------------------------------------------------------
 * Why this is not applied to the whole site
 *
 * A nonce must be minted per request and injected during server rendering, so
 * Next can only do it on a DYNAMICALLY rendered page — its own guide is
 * explicit: "Static pages are generated at build time, when no request or
 * response headers exist, so no nonce can be injected."
 *
 * Applying it everywhere would therefore force every page dynamic, and the
 * home page is `revalidate = 300` — one cached render served from
 * Cloudflare's edge to every visitor. Turning that into a render per request,
 * for a shop whose traffic is phones on slow Bangladeshi connections, would
 * be a real cost.
 *
 * The happy accident is that the split falls exactly where the risk does.
 * From the build output, every page that takes input or shows personal data
 * is ALREADY dynamic:
 *
 *   dynamic  /shop  /shop/[slug]  /cart  /checkout  /track  /wishlist
 *            /contact  /shipping  /order/[token]
 *   static   /  /about  /policies/*  /size-guide  (marketing and legal only)
 *
 * So the strict policy covers the whole attack surface — the checkout, the
 * cart, the order receipt, the product pages that render catalogue text — at
 * no cache cost at all. The static pages keep the narrower policy from
 * next.config.ts, and they take no user input to attack.
 *
 * ---------------------------------------------------------------------------
 * The matcher is an explicit list, on purpose
 *
 * A negative pattern ("everything except the static ones") is shorter and
 * fails the wrong way: a new dynamic route silently gets no protection is bad,
 * but a negative pattern accidentally catching a STATIC route is worse — it
 * forces that page dynamic and quietly deletes its cache, which nobody would
 * notice until the bill or the Lighthouse score changed.
 *
 * With this list the failure mode is the safe one. Add a route here when you
 * add a dynamic page; forget, and it merely keeps the weaker policy.
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    /*
     * 'self' AND a nonce, deliberately WITHOUT 'strict-dynamic'.
     *
     * 'strict-dynamic' was here first and had to go, because it breaks the
     * page-transition animation in production. Next renders app/template.tsx
     * by emitting a plain <script src> for its chunk through
     * createComponentStylesAndScripts, which calls
     *   createElement('script', { src, async, key })
     * and passes NO nonce — verified in
     * node_modules/next/dist/server/app-render/create-component-styles-and-scripts.js.
     * Every other script tag on the page carries one; that single tag cannot.
     *
     * 'strict-dynamic' disables host allowlisting outright ("Note that
     * 'strict-dynamic' is present, so host-based allowlisting is disabled"),
     * so 'self' could not cover for it and the chunk was refused. The visible
     * symptom was mild — the route fade stopped running, the page stayed
     * usable — which is exactly why it needs a comment: it looked fine.
     *
     * WHAT IS LOST: with plain 'self', an injected <script src> pointing at
     * our OWN origin would be allowed. That requires a same-origin URL that
     * returns attacker-controlled JavaScript. There is none — the API routes
     * return JSON and X-Content-Type-Options: nosniff stops a browser
     * executing those as script, and everything else on the origin is build
     * output.
     *
     * WHAT IS KEPT, and it is the part that matters: no 'unsafe-inline', so
     * an inline <script> without the nonce will not run and neither will an
     * inline event handler — the two shapes a stored XSS actually takes here.
     * scripts/csp-test.mjs asserts both, on a production build.
     *
     * React needs 'unsafe-eval' in development only, to rebuild server stack
     * traces in the browser.
     */
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    /*
     * 'unsafe-inline' for STYLES, and it is not laziness.
     *
     * A nonce cannot cover a style ATTRIBUTE — nonces apply to elements, and
     * `style="..."` is governed by style-src-attr, which has no nonce form.
     * This site sets inline styles from `motion` on every animated element
     * and from PlaceholderTile's gradients, so blocking them strips the
     * design. CSS injection is also a far smaller prize than script
     * injection: no data exfiltration, no session theft.
     */
    "style-src 'self' 'unsafe-inline'",
    /* data: for the SVG favicon and any inlined asset; Cloudinary for
       product photography once it is uploaded. */
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    /* Server actions post to our own origin. Nothing else is called from the
       browser — the Supabase service-role key is server-only. */
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  /*
   * Next reads the CSP off the REQUEST header and applies the nonce to its
   * own framework scripts, page bundles and inline scripts automatically, so
   * nothing in the app has to thread it through — except our own hand-written
   * inline tags, which read it from x-nonce.
   */
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  /* Overwrites the weaker policy that next.config.ts set for this path. */
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/shop",
    "/shop/:path*",
    "/cart",
    "/checkout",
    "/track",
    "/wishlist",
    "/contact",
    "/shipping",
    "/order/:path*",
  ],
};
