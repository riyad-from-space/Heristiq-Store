import "server-only";
import type { DeliveryTerms } from "@/lib/delivery";
import { deliverySettings } from "@/lib/settings";

/*
 * Where the delivery numbers come from.
 *
 * Now the storefront_settings table, with the environment as a fallback — so
 * the owner changes a delivery fee from the ERP and the site follows without a
 * deploy. The shape is unchanged from when this read env directly, which is
 * why nothing that consumes it had to move.
 *
 * Async now, and that is the only difference at the call sites: every one of
 * them was already in a server component or a server action.
 */
export async function deliveryTerms(): Promise<DeliveryTerms> {
  return deliverySettings();
}
