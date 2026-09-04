import "server-only";
import { courierEnv } from "@/lib/env";
import { courier } from "@/lib/courier";
import { CourierError } from "@/lib/courier/provider";
import { shipments, type Shipment, type StatusEvent } from "@/lib/courier/store";
import { isDelivered } from "@/lib/courier/status";
import { formatAddress } from "@/lib/bd-geo";
import { erp } from "@/lib/erp";
import { amountDue, type CourierKey, type StoreOrder } from "@/lib/orders/types";

/*
 * Handing a parcel to a courier, and hearing back about it.
 *
 * The one-tap push from the brief. Phase 6's admin button calls
 * `pushOrderToCourier`; today the same function sits behind a token-protected
 * route (app/api/admin/orders/[reference]/ship) so the owner can put it in a
 * phone shortcut.
 *
 * The rule that shapes this file: a courier push is not idempotent and cannot
 * be made so — the courier assigns the id, so we cannot pre-generate one to
 * deduplicate on. Two pushes means two riders at one door and two delivery
 * charges. So the guards come first and the retry advice is explicit.
 */

export type PushResult =
  | {
      ok: true;
      shipment: Shipment;
      reference: string;
      /** Set when the recipient's courier history is worth a look first. */
      riskNote: string | null;
      /** True when nothing was really sent — no ERP credentials configured. */
      demo: boolean;
    }
  | {
      ok: false;
      error: string;
      /** Safe to press again. False when it might have gone through. */
      retryable: boolean;
      /** Already shipped: here is what it already has. */
      existing?: Shipment;
    };

/**
 * What goes in the courier's "item description" field.
 *
 * Deliberately vague about contents. A manifest line reading "gold waist
 * chain" on a parcel travelling by third-party courier through several hands
 * is an invitation, and the rider needs to know the size and the money, not
 * the jewellery.
 */
function itemDescription(order: StoreOrder): string {
  const pieces = order.lines.reduce((sum, line) => sum + line.qty, 0);
  return `Fashion accessory x${pieces}`;
}

export async function pushOrderToCourier(
  reference: string,
  options: { courier?: CourierKey | null } = {},
): Promise<PushResult> {
  const client = erp();
  const order = await client.findOrderByReference(reference);

  if (!order) {
    return { ok: false, error: `No order ${reference}.`, retryable: false };
  }

  const store = shipments();

  /*
   * Already shipped is the first check, before anything talks to a courier.
   * This is the guard that stops a double tap on a phone, a retried request,
   * or an impatient owner from creating a second consignment.
   */
  const existing = await store.forOrder(order.id);
  if (existing) {
    return {
      ok: false,
      error: `${reference} is already with ${existing.courier} (${existing.trackingCode ?? existing.consignmentId}).`,
      retryable: false,
      existing,
    };
  }

  if (order.status === "cancelled") {
    return {
      ok: false,
      error: `${reference} is cancelled.`,
      retryable: false,
    };
  }

  /*
   * An unverified phone is not refused here, only reported. Refusing would
   * strand orders the owner took over WhatsApp and entered by hand, which is
   * a normal way this business works.
   */
  const provider = courier(options.courier ?? order.courierPreference);

  if (!provider.configured) {
    return {
      ok: false,
      error: `${provider.label} has no credentials configured.`,
      retryable: false,
    };
  }

  /*
   * The risk check runs BEFORE the push and never blocks it — the brief asks
   * for risky numbers to be surfaced before an order is marked ready to ship,
   * and surfacing is exactly what this does. It is also wrapped: a courier's
   * fraud endpoint being down must not stop a parcel.
   */
  let riskNote: string | null = null;
  if (provider.riskCheck) {
    try {
      const profile = await provider.riskCheck(order.customerPhone);
      if (profile) {
        await store.saveRisk(profile);
        if (
          profile.totalParcels >= courierEnv.riskMinParcels &&
          profile.successRatio !== null &&
          profile.successRatio < courierEnv.riskSuccessFloor
        ) {
          riskNote =
            `${profile.successRatio}% delivery success across ${profile.totalParcels} parcels ` +
            `(${profile.cancelled} cancelled). Worth a call before it goes out.`;
        }
      }
    } catch (error) {
      console.warn("[courier] risk check failed, continuing", error);
    }
  }

  const due = amountDue(order);

  try {
    const created = await provider.createShipment({
      reference: order.reference,
      recipientName: order.customerName,
      recipientPhone: order.customerPhone,
      /* One line, exactly as the rider will read it. */
      recipientAddress: formatAddress(order.address),
      /* And the parts, for a courier that routes on its own taxonomy rather
         than on the written line. See lib/courier/pathao-locations.ts. */
      division: order.address.division,
      district: order.address.district,
      area: order.address.area,
      /* What is left to collect, not the order total — a pre-order advance or
         a COD deposit has already been paid and must not be collected twice. */
      codAmount: due,
      note: order.customerNote,
      deliveryType: courierEnv.deliveryType,
      itemDescription: itemDescription(order),
      totalLot: 1,
    });

    const shipment = await store.create({
      orderId: order.id,
      courier: provider.key,
      consignmentId: created.consignmentId,
      trackingCode: created.trackingCode,
      status: created.status,
      rawStatus: created.rawStatus,
      codAmount: due,
      deliveryType: courierEnv.deliveryType === "hub" ? 1 : 0,
      courierFee: created.courierFee ?? null,
      location: created.location ?? null,
    });

    /*
     * Recorded through the same path a webhook takes, so the order's own
     * status and its audit trail are written by one piece of logic rather than
     * two that can disagree.
     */
    await store.apply({
      courier: provider.key,
      status: created.status,
      rawStatus: created.rawStatus,
      consignmentId: created.consignmentId,
      trackingCode: created.trackingCode,
      reference: order.reference,
      eventKey: `push:${created.consignmentId ?? created.trackingCode}`,
      source: "manual",
    });

    return {
      ok: true,
      shipment,
      reference: order.reference,
      riskNote,
      demo: store.source === "memory",
    };
  } catch (error) {
    if (error instanceof CourierError) {
      /*
       * `uncertain` is the case that needs words rather than a retry button.
       * The consignment may exist; pressing again would create a second one.
       */
      if (error.uncertain) {
        return {
          ok: false,
          retryable: false,
          error:
            `${provider.label} may or may not have accepted ${reference}: ${error.message} ` +
            `Check their portal for invoice ${reference} BEFORE pushing again — ` +
            `a second push means two riders and two delivery charges.`,
        };
      }
      return { ok: false, error: error.message, retryable: error.retryable };
    }
    console.error("[courier] push failed", error);
    return {
      ok: false,
      error: "The courier push failed for an unexpected reason. Check the logs.",
      retryable: false,
    };
  }
}

/**
 * Ask the courier where a parcel is, and record the answer.
 *
 * The fallback for when a webhook never arrives — which happens: the portal's
 * callback URL gets cleared, a deploy changes the token, a retry budget runs
 * out. Same write path as the webhook, so a poll and a callback cannot leave
 * the shipment in different states.
 */
export async function syncShipment(
  shipment: Shipment,
  options: { minIntervalSeconds?: number } = {},
): Promise<{ status: Shipment["status"]; changed: boolean }> {
  /* Nothing to ask about a parcel that has arrived or come back. */
  if (isDelivered(shipment.status) || shipment.status === "returned") {
    return { status: shipment.status, changed: false };
  }

  /*
   * Don't ask again if we just did.
   *
   * The tracking page calls this on every lookup, and an anxious customer
   * refreshing four times in a minute should not become four calls to the
   * courier — theirs are rate limited, and a webhook has almost certainly
   * already told us. The stored status is the answer in between.
   */
  const minInterval = options.minIntervalSeconds ?? 0;
  if (minInterval > 0 && shipment.lastSyncedAt) {
    const age = (Date.now() - new Date(shipment.lastSyncedAt).getTime()) / 1000;
    if (age < minInterval) return { status: shipment.status, changed: false };
  }

  const provider = courier(shipment.courier);
  if (!provider.configured) return { status: shipment.status, changed: false };

  const snapshot = await provider.track({
    consignmentId: shipment.consignmentId,
    trackingCode: shipment.trackingCode,
  });

  const result = await shipments().apply({
    courier: shipment.courier,
    status: snapshot.status,
    rawStatus: snapshot.rawStatus,
    consignmentId: shipment.consignmentId,
    trackingCode: shipment.trackingCode,
    /*
     * Keyed on the status, not the moment. A poll that finds the same status
     * five times must record one event, not five — otherwise the audit trail
     * becomes a poll log and the real transitions are lost in it.
     */
    eventKey: `poll:${shipment.consignmentId ?? shipment.trackingCode}:${snapshot.status}`,
    source: "poll",
  });

  return { status: result.newStatus, changed: result.changed };
}

/** Record a courier's own callback. Thin: the store's RPC does the work. */
export async function applyCourierEvent(event: StatusEvent) {
  return shipments().apply(event);
}
