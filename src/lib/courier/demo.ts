import "server-only";
import { devStore } from "@/lib/dev-store";
import type {
  CourierProvider,
  CreatedShipment,
  RiskProfile,
  ShipmentRef,
  ShipmentRequest,
  TrackingSnapshot,
} from "@/lib/courier/provider";
import type { CourierStatus } from "@/lib/courier/status";
import type { CourierKey } from "@/lib/orders/types";

/*
 * A courier that does not exist, for development.
 *
 * The same reasoning as the mock catalogue, the memory OTP store and the
 * memory shipment store: this site must be runnable and reviewable with no
 * credentials at all, and the courier flow — push, tracking page, status
 * changes — is the half of phase 4 that cannot be looked at otherwise.
 *
 * NEVER reachable in production. lib/courier/index.ts only substitutes it when
 * NODE_ENV is not production AND the real provider has no credentials, and the
 * push reports `demo: true` so nothing downstream can mistake it for a parcel
 * that is actually moving.
 *
 * It advances one step every time it is asked where the parcel is, which makes
 * the five-step rail on /track walkable by pressing Track repeatedly.
 */
const PROGRESSION: CourierStatus[] = [
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cod_collected",
];

/* On globalThis so a shipment keeps progressing across requests, whichever
   module graph asks. See lib/dev-store.ts. */
const progress = devStore("courier:demo-progress", () => new Map<string, number>());

export class DemoCourierProvider implements CourierProvider {
  readonly label: string;
  readonly configured = true;

  constructor(readonly key: CourierKey) {
    this.label = `${key[0].toUpperCase()}${key.slice(1)} (demo)`;
  }

  normalise(raw: string): CourierStatus {
    return (PROGRESSION as readonly string[]).includes(raw)
      ? (raw as CourierStatus)
      : "unknown";
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    const id = `DEMO${Date.now().toString().slice(-7)}`;
    progress.set(id, 0);
    console.info(
      `[courier:demo] pretended to ship ${request.reference} → ${id} (৳${request.codAmount} to collect)`,
    );
    return {
      consignmentId: id,
      trackingCode: id,
      status: "pickup_scheduled",
      rawStatus: "pickup_scheduled",
    };
  }

  async track(ref: ShipmentRef): Promise<TrackingSnapshot> {
    const id = ref.consignmentId ?? ref.trackingCode ?? "unknown";
    const next = Math.min((progress.get(id) ?? 0) + 1, PROGRESSION.length - 1);
    progress.set(id, next);
    const status = PROGRESSION[next];
    return { status, rawStatus: status, updatedAt: new Date().toISOString() };
  }

  async balance() {
    return 0;
  }

  async riskCheck(phone: string): Promise<RiskProfile | null> {
    /*
     * A number ending in 0 comes back looking risky, so the flag on the push
     * result can be seen working without inventing a fraudster.
     */
    const risky = phone.endsWith("0");
    return {
      phone,
      totalParcels: risky ? 12 : 8,
      delivered: risky ? 5 : 8,
      cancelled: risky ? 7 : 0,
      successRatio: risky ? 42 : 100,
      source: this.key,
    };
  }
}
