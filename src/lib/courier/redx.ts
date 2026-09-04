import "server-only";
import { redxEnv } from "@/lib/env";
import {
  CourierNotImplemented,
  type CourierProvider,
  type CreatedShipment,
  type ShipmentRef,
  type ShipmentRequest,
  type TrackingSnapshot,
} from "@/lib/courier/provider";
import type { CourierStatus } from "@/lib/courier/status";

/*
 * RedX — a stub behind the interface.
 *
 * Same reasoning as Pathao: the seam is what matters now, and RedX needs an
 * approved merchant account before any of it can be tested. Their API is the
 * simplest of the three (one long-lived access token, no OAuth dance), so this
 * is the shortest of the three files by some distance when it is finished.
 *
 * The documented shape:
 *
 *   GET  /areas                          → area_id list, their own taxonomy
 *   POST /parcel
 *        { customer_name, customer_phone, delivery_area, delivery_area_id,
 *          customer_address, merchant_invoice_id, cash_collection_amount,
 *          parcel_weight, instruction, value }
 *        → { tracking_id }
 *   GET  /parcel/info/{tracking_id}      → status + history
 *   GET  /pickup/stores
 *
 * All calls carry `API-ACCESS-TOKEN: Bearer <token>`.
 */

const STATUS_MAP: Record<string, CourierStatus> = {
  "pickup-pending": "pickup_scheduled",
  "pickup-assigned": "pickup_scheduled",
  "picked-up": "picked_up",
  "received-at-hub": "in_transit",
  "in-transit": "in_transit",
  "delivery-in-progress": "out_for_delivery",
  delivered: "delivered",
  "delivery-failed": "on_hold",
  hold: "on_hold",
  returned: "returned",
  "return-in-progress": "returned",
  cancelled: "cancelled",
  lost: "lost",
};

export class RedxProvider implements CourierProvider {
  readonly key = "redx" as const;
  readonly label = "RedX";

  get configured() {
    return redxEnv.configured;
  }

  normalise(raw: string): CourierStatus {
    const key = raw?.trim().toLowerCase().replace(/[\s_]+/g, "-");
    return STATUS_MAP[key] ?? "unknown";
  }

  async createShipment(_request: ShipmentRequest): Promise<CreatedShipment> {
    throw new CourierNotImplemented(
      this.key,
      "createShipment — needs RedX area ids mapped onto lib/bd-geo.ts",
    );
  }

  async track(_ref: ShipmentRef): Promise<TrackingSnapshot> {
    throw new CourierNotImplemented(this.key, "track");
  }
}
