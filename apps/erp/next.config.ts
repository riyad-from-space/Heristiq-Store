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

const nextConfig: NextConfig = {
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
