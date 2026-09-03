import "server-only";

/*
 * Server-side configuration.
 *
 * Read lazily, never at module load. A storefront must still BUILD on a machine
 * with no secrets (CI, a fresh clone, `next build` before the first deploy), and
 * validating at import time turns a missing key into a build failure instead of
 * a clear runtime message on one page.
 *
 * Nothing here is NEXT_PUBLIC_. The service-role key bypasses RLS, so it must
 * never be reachable from the browser bundle; `server-only` above makes an
 * accidental client import a compile error rather than a leak.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function required(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. See README.md → Environment.`,
    );
  }
  return value;
}

function bool(name: string, fallback = false): boolean {
  const value = read(name)?.toLowerCase();
  if (value === undefined) return fallback;
  return value === "1" || value === "true" || value === "yes";
}

function int(name: string, fallback: number): number {
  const n = Number(read(name));
  return Number.isFinite(n) ? n : fallback;
}

/** The ERP database (Supabase Postgres). Also the storefront's own store. */
export const erpEnv = {
  get url() {
    return required("SUPABASE_URL");
  },
  /** Bypasses RLS. Server-side only, always. */
  get serviceKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /**
   * True when both halves are present. The catalogue falls back to the seeded
   * mock when they are not, so the site is fully browsable on a fresh clone.
   */
  get configured() {
    return Boolean(read("SUPABASE_URL") && read("SUPABASE_SERVICE_ROLE_KEY"));
  },
  /** Force the mock even with credentials present — useful for design work. */
  get forceMock() {
    return bool("ERP_USE_MOCK");
  },
};

/**
 * Commerce numbers that change with every promotion. These are env fallbacks
 * only — the live values come from the storefront_settings table so the owner
 * can change them from a phone without a deploy (phase 6).
 */
export const commerceEnv = {
  get deliveryFeeInside() {
    return int("DELIVERY_FEE_INSIDE_DHAKA", 70);
  },
  get deliveryFeeOutside() {
    return int("DELIVERY_FEE_OUTSIDE_DHAKA", 130);
  },
  get freeDeliveryThreshold() {
    return int("FREE_DELIVERY_THRESHOLD", 1500);
  },
  get lowStockAt() {
    return int("LOW_STOCK_THRESHOLD", 3);
  },
};

export const siteEnv = {
  get baseUrl() {
    return read("NEXT_PUBLIC_SITE_URL") ?? "https://heristiq.com";
  },
};
