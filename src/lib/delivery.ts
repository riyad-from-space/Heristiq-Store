import { commerceEnv } from "@/lib/env";

/*
 * Delivery promise and fee.
 *
 * Both are read from config, never hard-coded in a component: the fee and the
 * free-delivery threshold change with every promotion, and the brief is
 * explicit that the owner must be able to change them without a deploy. Phase 6
 * moves the source from env to the storefront_settings table; this function's
 * shape does not change when it does.
 */
export type DeliveryTerms = {
  insideDhakaFee: number;
  outsideDhakaFee: number;
  freeThreshold: number;
  insideDays: { min: number; max: number };
  outsideDays: { min: number; max: number };
};

export function deliveryTerms(): DeliveryTerms {
  return {
    insideDhakaFee: commerceEnv.deliveryFeeInside,
    outsideDhakaFee: commerceEnv.deliveryFeeOutside,
    freeThreshold: commerceEnv.freeDeliveryThreshold,
    /* Courier SLAs, stated conservatively. Promising next-day everywhere and
       missing it costs more than promising two days and beating it. */
    insideDays: { min: 1, max: 2 },
    outsideDays: { min: 2, max: 4 },
  };
}

/** Fee for a cart subtotal, given whether the address is inside Dhaka. */
export function deliveryFeeFor(
  subtotal: number,
  insideDhaka: boolean,
  terms = deliveryTerms(),
) {
  if (terms.freeThreshold > 0 && subtotal >= terms.freeThreshold) return 0;
  return insideDhaka ? terms.insideDhakaFee : terms.outsideDhakaFee;
}
