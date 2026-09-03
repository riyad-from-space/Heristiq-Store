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

/**
 * Secrets that sign and hash. There is exactly one, used two ways: to HMAC an
 * OTP code before it is stored, and to sign the cookie that says a phone number
 * was verified.
 *
 * In production this is required and its absence is a hard failure — an
 * unsigned verification cookie is a cookie anyone can forge into "this phone is
 * verified", which is precisely the anti-fraud control it exists to provide.
 *
 * In development it falls back to a fixed string so a fresh clone can run the
 * whole checkout. That fallback is gated on NODE_ENV, so it cannot be what
 * production ends up using by accident.
 */
export const authEnv = {
  get secret() {
    const configured = read("STOREFRONT_SECRET");
    if (configured) return configured;
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Missing STOREFRONT_SECRET. It signs the phone-verification cookie and " +
          "hashes OTP codes; without it either can be forged. " +
          "Generate one with `openssl rand -hex 32`. See README.md → Environment.",
      );
    }
    return "heristiq-development-only-secret";
  },
  get isDefaultSecret() {
    return !read("STOREFRONT_SECRET");
  },
};

/**
 * The SMS gateway that delivers OTP codes.
 *
 * Deliberately generic. Bangladeshi bulk-SMS providers (BulkSMSBD, MIMSMS,
 * Alpha Net, REVE) all expose the same shape — one HTTP call with an API key,
 * a sender id, a number and a message — and which one this business ends up on
 * depends on trade-licence paperwork nobody has finished. So the URL is a
 * template rather than a vendor name. See lib/otp/sender.ts.
 */
export const smsEnv = {
  get url() {
    return read("SMS_API_URL");
  },
  get apiKey() {
    return read("SMS_API_KEY");
  },
  get senderId() {
    return read("SMS_SENDER_ID");
  },
  get method() {
    return read("SMS_API_METHOD")?.toUpperCase() === "POST" ? "POST" : "GET";
  },
  get configured() {
    return Boolean(read("SMS_API_URL"));
  },
};

export const otpEnv = {
  /** Codes are valid for this long. Long enough for a slow SMS, short enough to matter. */
  get ttlSeconds() {
    return int("OTP_TTL_SECONDS", 300);
  },
  /** Wrong guesses allowed per code before it is dead. */
  get maxAttempts() {
    return int("OTP_MAX_ATTEMPTS", 5);
  },
  /** Codes one phone number may request per hour. */
  get maxPerHour() {
    return int("OTP_MAX_PER_HOUR", 5);
  },
  /** Minimum wait between two requests for the same number. */
  get resendCooldownSeconds() {
    return int("OTP_RESEND_COOLDOWN_SECONDS", 60);
  },
  /**
   * Return the code to the browser instead of texting it.
   *
   * Ignored in production, unconditionally — see lib/otp/service.ts. Without
   * this a developer with no SMS gateway cannot get past checkout at all.
   */
  get debug() {
    return bool("OTP_DEBUG", process.env.NODE_ENV !== "production");
  },
};

export const siteEnv = {
  get baseUrl() {
    return read("NEXT_PUBLIC_SITE_URL") ?? "https://heristiq.com";
  },
};
