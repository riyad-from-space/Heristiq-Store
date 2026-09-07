import "server-only";
import { erpDb } from "@/lib/erp/supabase";
import { erpEnv, commerceEnv } from "@/lib/env";
import type { DeliveryTerms } from "@/lib/delivery";

/*
 * Settings the owner can change without a deploy.
 *
 * The delivery fee, the free-delivery threshold and the promo banner move with
 * every promotion. They were environment variables, which means changing one
 * is a redeploy, which in practice means they never change.
 *
 * Everything here degrades rather than fails. No credentials, or migration
 * 1004 not applied yet, and the env defaults are used — so the site keeps
 * working and the numbers stay whatever they were.
 */

export type PromoSetting = {
  enabled: boolean;
  message: string;
  href: string;
};

export type PaymentSetting = {
  /** A small advance on COD, to reduce fake orders. */
  codDepositEnabled: boolean;
  codDepositAmount: number;
  /** Merchant numbers the customer sends money to. Empty = that method is off. */
  bkashNumber: string;
  nagadNumber: string;
};

type Row = { key: string; value: Record<string, unknown> };

/*
 * One read per request, not per component.
 *
 * The header, the cart and the checkout summary all want the delivery terms,
 * and three round trips for one row would be three round trips. React's cache
 * is not used because this must also work outside a request (the courier push
 * runs from a route handler), so it is a plain promise memo with a short TTL.
 */
let cached: { at: number; rows: Map<string, Record<string, unknown>> } | null = null;
const TTL_MS = 30_000;

async function load(): Promise<Map<string, Record<string, unknown>>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rows;

  const rows = new Map<string, Record<string, unknown>>();

  if (erpEnv.configured && !erpEnv.forceMock) {
    try {
      const { data, error } = await erpDb()
        .from("storefront_settings")
        .select("key, value");
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Row[]) rows.set(row.key, row.value ?? {});
    } catch (error) {
      /* Table missing, or the database is unreachable. Env defaults below. */
      console.warn("[settings] falling back to environment defaults:", error);
    }
  }

  cached = { at: Date.now(), rows };
  return rows;
}

/** Drop the memo — called after the admin saves a setting. */
export function invalidateSettings() {
  cached = null;
}

function int(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function deliverySettings(): Promise<DeliveryTerms> {
  const row = (await load()).get("delivery") ?? {};
  return {
    insideDhakaFee: int(row.inside_dhaka_fee, commerceEnv.deliveryFeeInside),
    outsideDhakaFee: int(row.outside_dhaka_fee, commerceEnv.deliveryFeeOutside),
    freeThreshold: int(row.free_threshold, commerceEnv.freeDeliveryThreshold),
    insideDays: {
      min: int(row.inside_days_min, 1),
      max: int(row.inside_days_max, 2),
    },
    outsideDays: {
      min: int(row.outside_days_min, 2),
      max: int(row.outside_days_max, 4),
    },
  };
}

export async function promoSettings(): Promise<PromoSetting> {
  const row = (await load()).get("promo") ?? {};
  const message = str(row.message);
  return {
    /* A banner with no words is not enabled, whatever the flag says. */
    enabled: row.enabled === true && message.length > 0,
    message,
    href: str(row.href),
  };
}

export async function paymentSettings(): Promise<PaymentSetting> {
  const row = (await load()).get("payment") ?? {};
  const bkash = str(row.bkash_number);
  const nagad = str(row.nagad_number);
  return {
    /*
     * A deposit cannot be collected without a number to send it to, so an
     * enabled flag with no merchant number is off. This is the setting most
     * likely to be half-configured and it would otherwise strand a customer
     * on a payment step with nowhere to pay.
     */
    codDepositEnabled:
      row.cod_deposit_enabled === true && (bkash !== "" || nagad !== ""),
    codDepositAmount: int(row.cod_deposit_amount, 100),
    bkashNumber: bkash,
    nagadNumber: nagad,
  };
}

/** Write one setting. Admin only — called from the ERP, never the storefront. */
export async function saveSetting(
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  const { error } = await erpDb()
    .from("storefront_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Setting write failed: ${error.message}`);
  invalidateSettings();
}
