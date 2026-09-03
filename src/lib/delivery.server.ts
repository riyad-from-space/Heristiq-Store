import "server-only";
import { commerceEnv } from "@/lib/env";
import type { DeliveryTerms } from "@/lib/delivery";

/*
 * Where the delivery numbers come from.
 *
 * Separate from lib/delivery.ts so the arithmetic can run in the browser while
 * the source of the numbers stays server-side. The fee and the free-delivery
 * threshold change with every promotion and the owner must be able to change
 * them without a deploy, so they are never written in a component.
 *
 * Phase 6 replaces the env reads with a storefront_settings query. This
 * function's shape does not change when it does, which is the whole point of
 * it existing.
 */
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
