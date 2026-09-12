import { NextResponse, type NextRequest } from "next/server";

/*
 * A strict, nonce-based Content-Security-Policy for the whole ERP.
 *
 * The whole of it, with no exclusions and no cache to weigh against it: every
 * ERP page is behind authentication and therefore already dynamic, so the
 * nonce costs nothing here. This is also the app where an injected script
 * would hurt most — it holds cost, margin, supplier and customer data, and a
 * live admin session.
 *
 * connect-src has to allow Supabase: unlike the storefront, the ERP talks to
 * the database FROM THE BROWSER with the anon key, and RLS is what makes that
 * safe. The wildcard covers whichever project ref this deploys against.
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    /* 'self' plus a nonce, no 'strict-dynamic' — see the storefront's proxy
       for why. Next emits app/template.tsx's chunk as a <script src> with no
       nonce, and 'strict-dynamic' disables the host allowlist that would
       otherwise cover it. Kept identical in both apps so the two policies do
       not quietly diverge. */
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    /* See the storefront's proxy: a nonce cannot cover a style attribute. */
    "style-src 'self' 'unsafe-inline'",
    /* res.cloudinary.com is the product photographs, shown as thumbnails on
       the product page. blob: is the local preview of a file the owner has
       picked but not yet uploaded. */
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    /* api.cloudinary.com is the upload endpoint. The browser POSTs the
       photograph THERE rather than here — see lib/cloudinary.ts — so without
       this the upload fails, and it fails the way CSP always does: silently,
       with nothing in the network tab but a blocked request. */
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  /*
   * Everything except Next's own static output, which needs no policy and is
   * served straight from the edge.
   *
   * "/" is listed SEPARATELY, and it is not redundant. The catch-all below
   * compiles to a path-to-regexp group that requires a non-empty segment, so
   * it matches /orders and /sign-in but NOT the bare root — which, under this
   * app's basePath, is /admin: the dashboard the owner actually lands on.
   * Measured before this line existed: /admin/orders carried a nonce and
   * /admin carried none, silently falling back to the weaker policy on the
   * one ERP page most likely to be open.
   */
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
