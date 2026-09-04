import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
