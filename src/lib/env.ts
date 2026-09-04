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

/**
 * Steadfast, the courier this business actually uses.
 *
 * Base URL is configurable because Steadfast serves the same API from two
 * hostnames — portal.steadfast.com.bd and portal.packzy.com (Packzy is the
 * platform behind it) — and which one their docs point at has changed.
 */
export const steadfastEnv = {
  get baseUrl() {
    return (
      read("STEADFAST_BASE_URL") ?? "https://portal.steadfast.com.bd/api/v1"
    );
  },
  get apiKey() {
    return read("STEADFAST_API_KEY");
  },
  get secretKey() {
    return read("STEADFAST_SECRET_KEY");
  },
  get configured() {
    return Boolean(read("STEADFAST_API_KEY") && read("STEADFAST_SECRET_KEY"));
  },
  /**
   * The token Steadfast sends back as `Authorization: Bearer …` on the
   * delivery-status webhook. Whatever you typed into the portal goes here.
   * Without it the webhook route rejects everything, which is the correct
   * default for an endpoint that changes order state.
   */
  get webhookToken() {
    return read("STEADFAST_WEBHOOK_TOKEN");
  },
  /**
   * Path of the fraud/history check, relative to the base URL, with {phone}
   * substituted.
   *
   * Configurable because it is the one Steadfast endpoint this codebase has
   * not been able to confirm against their current documentation. The check is
   * advisory — a wrong path logs and returns no data, and never blocks an
   * order — so getting it wrong is cheap and fixing it needs no deploy.
   */
  get fraudCheckPath() {
    return read("STEADFAST_FRAUD_CHECK_PATH") ?? "fraud_check/{phone}";
  },
};

/**
 * Pathao Courier — the courier this business uses.
 *
 * Two hosts, and they are not interchangeable: the merchant API is
 * api-hermes.pathao.com in production and courier-api-sandbox.pathao.com for
 * testing, while the delivery-history endpoint lives on merchant.pathao.com
 * (see lib/courier/pathao.ts). Set PATHAO_ENVIRONMENT=sandbox to develop
 * against their sandbox with test credentials.
 */
export const pathaoEnv = {
  get baseUrl() {
    const configured = read("PATHAO_BASE_URL");
    if (configured) return configured;
    return read("PATHAO_ENVIRONMENT")?.toLowerCase() === "sandbox"
      ? "https://courier-api-sandbox.pathao.com"
      : "https://api-hermes.pathao.com";
  },
  get clientId() {
    return read("PATHAO_CLIENT_ID");
  },
  get clientSecret() {
    return read("PATHAO_CLIENT_SECRET");
  },
  get username() {
    return read("PATHAO_USERNAME");
  },
  get password() {
    return read("PATHAO_PASSWORD");
  },
  get storeId() {
    return read("PATHAO_STORE_ID");
  },
  /**
   * Who the parcel is from. Pathao requires both on every order.
   *
   * Defaults to the brand name and the number on the site, because that is
   * what a customer expects to see on a parcel and what they will call — but
   * overridable, since the number that answers pickup calls is not always the
   * number on the website.
   */
  get senderName() {
    return read("PATHAO_SENDER_NAME") ?? "Heristiq";
  },
  get senderPhone() {
    return read("PATHAO_SENDER_PHONE") ?? "01712345678";
  },
  /**
   * Declared parcel weight in kg. Pathao prices on it and their minimum is
   * 0.5kg; a waist chain in a pouch is nowhere near that, so the minimum is
   * the honest declaration rather than a guess at grams.
   */
  get itemWeight() {
    const raw = Number(read("PATHAO_ITEM_WEIGHT") ?? 0.5);
    return Number.isFinite(raw) && raw > 0 ? raw : 0.5;
  },
  /**
   * The secret Pathao sends back in the X-PATHAO-Signature header on every
   * webhook. Whatever you typed into their merchant dashboard goes here.
   * Without it the webhook route rejects everything, which is the right
   * default for an endpoint that can mark an order delivered.
   */
  get webhookSecret() {
    return read("PATHAO_WEBHOOK_SECRET");
  },
  get configured() {
    return Boolean(
      read("PATHAO_CLIENT_ID") &&
        read("PATHAO_CLIENT_SECRET") &&
        read("PATHAO_USERNAME") &&
        read("PATHAO_PASSWORD") &&
        read("PATHAO_STORE_ID"),
    );
  },
};

export const redxEnv = {
  get baseUrl() {
    return read("REDX_BASE_URL") ?? "https://openapi.redx.com.bd/v1.0.0-beta";
  },
  get accessToken() {
    return read("REDX_ACCESS_TOKEN");
  },
  get configured() {
    return Boolean(read("REDX_ACCESS_TOKEN"));
  },
};

export const courierEnv = {
  /**
   * Who gets the parcel when the customer expressed no preference.
   *
   * Pathao, because that is the courier this business actually uses. Steadfast
   * is implemented too and is one env var away.
   */
  get defaultCourier() {
    const value = read("COURIER_DEFAULT")?.toLowerCase();
    return value === "steadfast" || value === "redx" ? value : "pathao";
  },
  /** Home delivery unless told otherwise. 1 = the customer collects from a hub. */
  get deliveryType() {
    return read("COURIER_DELIVERY_TYPE") === "1" ? "hub" : "home";
  },
  /**
   * Flag an order for a call when the recipient's courier history is worse
   * than this percentage. Advisory: it annotates, it never refuses.
   */
  get riskSuccessFloor() {
    return int("COURIER_RISK_SUCCESS_FLOOR", 60);
  },
  /** Ignore the floor until the number has this much history to judge. */
  get riskMinParcels() {
    return int("COURIER_RISK_MIN_PARCELS", 3);
  },
};

/**
 * The owner's key for the endpoints that change an order — pushing it to a
 * courier, in this phase. Phase 6's admin UI authenticates properly; until
 * then this is a bearer token the owner keeps in a phone shortcut.
 *
 * No fallback, in any environment. An unauthenticated endpoint that hands a
 * stranger's address to a courier is worse than one that does not work.
 */
export const adminEnv = {
  get token() {
    return read("ADMIN_TOKEN");
  },
  get configured() {
    return Boolean(read("ADMIN_TOKEN"));
  },
};

export const siteEnv = {
  get baseUrl() {
    return read("NEXT_PUBLIC_SITE_URL") ?? "https://heristiq.com";
  },
};
