/*
 * Delivery promise and fee — the arithmetic only.
 *
 * This module imports nothing from lib/env, and that is load-bearing: the
 * checkout form has to show the fee change the instant a customer picks a
 * district, so the same function must run in the browser. lib/env is
 * `server-only`, so reading the numbers here would make importing this file
 * from a client component a build error.
 *
 * Where the numbers come from is therefore the caller's problem:
 * lib/delivery.server.ts reads them from the environment and a server component
 * passes them down as props. Phase 6 changes that function to read
 * storefront_settings; nothing in this file moves.
 */
export type DeliveryTerms = {
  insideDhakaFee: number;
  outsideDhakaFee: number;
  /** 0 disables free delivery entirely. */
  freeThreshold: number;
  insideDays: { min: number; max: number };
  outsideDays: { min: number; max: number };
};

/** Fee for a cart subtotal, given whether the address is inside Dhaka. */
export function deliveryFeeFor(
  subtotal: number,
  insideDhaka: boolean,
  terms: DeliveryTerms,
): number {
  if (terms.freeThreshold > 0 && subtotal >= terms.freeThreshold) return 0;
  return insideDhaka ? terms.insideDhakaFee : terms.outsideDhakaFee;
}

/**
 * How much more is needed to earn free delivery, or null when it is already
 * earned or not on offer. Drives the "৳310 away from free delivery" nudge,
 * which is the cheapest way to lift an average order value this small.
 */
export function freeDeliveryGap(
  subtotal: number,
  terms: DeliveryTerms,
): number | null {
  if (terms.freeThreshold <= 0) return null;
  const gap = terms.freeThreshold - subtotal;
  return gap > 0 ? gap : null;
}
