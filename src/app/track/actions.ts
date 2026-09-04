"use server";

import { erp } from "@/lib/erp";
import { shipments } from "@/lib/courier/store";
import { syncShipment } from "@/lib/courier/dispatch";
import { normalisePhone } from "@/lib/phone";
import type { CourierStatus } from "@/lib/courier/status";
import { COURIERS, type CourierKey } from "@/lib/orders/types";

/*
 * "Where is my order."
 *
 * Requires the reference AND the phone the order was placed with. The brief
 * said "by phone or order id"; both alone are disclosures — the reference is
 * guessable by counting up from HQ-01001, and a phone number alone would let
 * anyone who has yours read your home address off this page. Together they are
 * something only the person who ordered has, and it is still one screen and no
 * login. The frictionless path is the link on the confirmation page, which
 * carries an unguessable token.
 *
 * What comes back is deliberately thin. This action is reachable by anyone who
 * can guess a pair, so it returns what is needed to answer the question and
 * nothing else: no address, no phone, no note, no order total beyond what is
 * still to pay.
 */
export type TrackResult =
  | {
      ok: true;
      reference: string;
      placedAt: string;
      /** null until the parcel is with a courier. */
      status: CourierStatus | null;
      courier: CourierKey | null;
      courierLabel: string | null;
      trackingCode: string | null;
      lastUpdatedAt: string | null;
      /** Item names and quantities — enough to recognise the order. */
      lines: { name: string; qty: number }[];
      amountDue: number;
      hasPreOrder: boolean;
    }
  | { ok: false; error: string };

export async function trackOrderAction(
  rawReference: string,
  rawPhone: string,
): Promise<TrackResult> {
  const reference = rawReference.trim().toUpperCase();
  const phone = normalisePhone(rawPhone);

  if (!reference || !phone) {
    return {
      ok: false,
      error: "Enter your order number and the mobile number you ordered with.",
    };
  }

  try {
    const order = await erp().findOrderForTracking(reference, phone);

    /*
     * One message for "no such order" and for "wrong phone for that order".
     * Distinguishing them would confirm that a reference exists, which is
     * exactly what someone counting upwards wants to know.
     */
    if (!order) {
      return {
        ok: false,
        error:
          "We could not find that order. Check the number — it looks like HQ-01042 — and that the phone is the one you ordered with.",
      };
    }

    const shipment = await shipments().forOrder(order.id);

    /*
     * Ask the courier while the customer is looking, but never let that hold
     * the page: a webhook usually got here first, and a courier API being slow
     * or down must not turn "where is my parcel" into an error.
     */
    let status = shipment?.status ?? null;
    if (shipment) {
      try {
        /* At most once a minute per shipment — a refreshing customer must
           not turn into a rate-limited courier account. */
        const synced = await syncShipment(shipment, { minIntervalSeconds: 60 });
        status = synced.status;
      } catch (error) {
        console.warn("[track] live sync failed, showing stored status", error);
      }
    }

    return {
      ok: true,
      reference: order.reference,
      placedAt: order.placedAt,
      status,
      courier: shipment?.courier ?? null,
      courierLabel: shipment ? COURIERS[shipment.courier] : null,
      trackingCode: shipment?.trackingCode ?? null,
      lastUpdatedAt: shipment?.updatedAt ?? null,
      lines: order.lines.map((line) => ({ name: line.name, qty: line.qty })),
      amountDue: Math.max(0, order.total - order.amountPaid),
      hasPreOrder: order.hasPreOrder,
    };
  } catch (error) {
    console.error("[track] lookup failed", error);
    return {
      ok: false,
      error: "Something went wrong looking that up. Try again in a moment.",
    };
  }
}
