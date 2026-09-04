import "server-only";
import { erpEnv } from "@/lib/env";
import { erpDb } from "@/lib/erp/supabase";
import { devStore } from "@/lib/dev-store";
import type { CourierStatus } from "@/lib/courier/status";
import type { RiskProfile } from "@/lib/courier/provider";
import type { CourierKey } from "@/lib/orders/types";

/*
 * Shipments, courier webhooks and cached risk notes.
 *
 * A store of its own rather than more methods on ErpClient, following the same
 * split as lib/otp/store.ts: ErpClient is the seam to the CATALOGUE and to an
 * order's own record, and shipments are a different concern with a different
 * lifetime. It also keeps the memory fallback small — the mock only has to
 * pretend about shipments, not about the whole ERP.
 *
 * The memory implementation exists so the courier flow can be walked end to
 * end with no credentials, exactly like the catalogue and the OTP. It is not
 * equivalent: it holds for one process, and it reimplements the stale-update
 * guard in TypeScript that Postgres does in SQL. That duplication is the price
 * of a dev environment that needs nothing, and it is called out here so nobody
 * "fixes" one copy alone.
 */

export type Shipment = {
  id: string;
  orderId: string;
  courier: CourierKey;
  consignmentId: string | null;
  trackingCode: string | null;
  status: CourierStatus;
  /** The courier's own string. The only thing that explains an `unknown`. */
  rawStatus: string | null;
  codAmount: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  deliveredAt: string | null;
};

export type NewShipment = {
  orderId: string;
  courier: CourierKey;
  consignmentId: string | null;
  trackingCode: string | null;
  status: CourierStatus;
  rawStatus: string | null;
  codAmount: number;
  /** 0 = home delivery, 1 = hub pickup. The courier's own encoding. */
  deliveryType: 0 | 1;
};

export type StatusEvent = {
  courier: CourierKey;
  status: CourierStatus;
  rawStatus: string | null;
  consignmentId?: string | null;
  trackingCode?: string | null;
  /** Our order reference, which couriers echo back as the invoice. */
  reference?: string | null;
  /** Unique per delivery of this event. What makes replays free. */
  eventKey: string;
  /** Where it came from, for the audit trail. */
  source: "webhook" | "poll" | "manual";
};

export type ApplyResult = {
  /** True when this exact event had already been applied. */
  duplicate: boolean;
  /** False when nothing matched, or the update was stale. */
  changed: boolean;
  orderReference: string | null;
  previousStatus: CourierStatus | null;
  newStatus: CourierStatus;
};

export interface ShipmentStore {
  /** The current shipment for an order — the newest, if it was re-sent. */
  forOrder(orderId: string): Promise<Shipment | null>;
  create(shipment: NewShipment): Promise<Shipment>;
  apply(event: StatusEvent): Promise<ApplyResult>;
  saveRisk(profile: RiskProfile): Promise<void>;
  readonly source: "erp" | "memory";
}

/* One literal, not a concatenation: supabase-js reads the column list from the
   string's TYPE to type the result, and `+` widens it to plain `string`. */
const SHIPMENT_COLUMNS = `
  id, order_id, courier, consignment_id, tracking_code, status, raw_status,
  cod_amount, created_at, updated_at, last_synced_at, delivered_at
`;

type ShipmentRow = {
  id: string;
  order_id: string;
  courier: CourierKey;
  consignment_id: string | null;
  tracking_code: string | null;
  status: CourierStatus;
  raw_status: string | null;
  cod_amount: number | string;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  delivered_at: string | null;
};

function toShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    orderId: row.order_id,
    courier: row.courier,
    consignmentId: row.consignment_id,
    trackingCode: row.tracking_code,
    status: row.status,
    rawStatus: row.raw_status,
    codAmount: Math.round(Number(row.cod_amount ?? 0)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
    deliveredAt: row.delivered_at,
  };
}

class SupabaseShipmentStore implements ShipmentStore {
  readonly source = "erp" as const;

  async forOrder(orderId: string): Promise<Shipment | null> {
    const { data, error } = await erpDb()
      .from("storefront_shipments")
      .select(SHIPMENT_COLUMNS)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Shipment read failed: ${error.message}`);
    return data ? toShipment(data as ShipmentRow) : null;
  }

  async create(shipment: NewShipment): Promise<Shipment> {
    const { data, error } = await erpDb()
      .from("storefront_shipments")
      .insert({
        order_id: shipment.orderId,
        courier: shipment.courier,
        consignment_id: shipment.consignmentId,
        tracking_code: shipment.trackingCode,
        status: shipment.status,
        raw_status: shipment.rawStatus,
        cod_amount: shipment.codAmount,
        delivery_type: shipment.deliveryType,
        last_synced_at: new Date().toISOString(),
      })
      .select(SHIPMENT_COLUMNS)
      .single();

    if (error) throw new Error(`Shipment write failed: ${error.message}`);
    return toShipment(data as ShipmentRow);
  }

  async apply(event: StatusEvent): Promise<ApplyResult> {
    /* All of it in one transaction, in the database: the shipment, the order's
       own status, the audit event and the webhook log. See
       apply_courier_status() in migration 1002. */
    const { data, error } = await erpDb()
      .rpc("apply_courier_status", {
        p: {
          courier: event.courier,
          status: event.status,
          raw_status: event.rawStatus,
          consignment_id: event.consignmentId ?? null,
          tracking_code: event.trackingCode ?? null,
          reference: event.reference ?? null,
          event_key: event.eventKey,
          source: event.source,
        },
      })
      .single();

    if (error) throw new Error(`Courier status write failed: ${error.message}`);

    const row = data as {
      shipment_id: string | null;
      order_reference: string | null;
      previous_status: CourierStatus | null;
      new_status: CourierStatus;
      duplicate: boolean;
    };

    return {
      duplicate: row.duplicate,
      /* Nothing matched, or the guard rejected it as stale — which the RPC
         reports by handing back the previous status as the new one. */
      changed:
        !row.duplicate &&
        row.shipment_id !== null &&
        row.previous_status !== row.new_status,
      orderReference: row.order_reference,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
    };
  }

  async saveRisk(profile: RiskProfile): Promise<void> {
    const { error } = await erpDb().from("storefront_phone_risk").upsert(
      {
        phone: profile.phone,
        courier: profile.source,
        total_parcels: profile.totalParcels,
        delivered: profile.delivered,
        cancelled: profile.cancelled,
        success_ratio: profile.successRatio,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "phone,courier" },
    );

    /* Advisory data. Failing to cache it must not fail the push it annotated. */
    if (error) console.warn("[courier] risk note not saved:", error.message);
  }
}

/*
 * Development only. On globalThis so a shipment created by the courier route
 * is visible to the tracking action, which is bundled separately. See
 * lib/dev-store.ts.
 */
const memory = devStore("shipments:rows", () => new Map<string, Shipment>());
const memoryEvents = devStore("shipments:events", () => new Set<string>());

/** Mirrors courier_status_rank() in migration 1002. Keep the two in step. */
const RANK: Record<CourierStatus, number> = {
  pickup_scheduled: 1,
  picked_up: 2,
  in_transit: 3,
  out_for_delivery: 4,
  delivered: 5,
  cod_collected: 6,
  on_hold: 0,
  returned: 0,
  lost: 0,
  cancelled: 0,
  unknown: 0,
};

class MemoryShipmentStore implements ShipmentStore {
  readonly source = "memory" as const;

  async forOrder(orderId: string): Promise<Shipment | null> {
    return (
      [...memory.values()]
        .filter((shipment) => shipment.orderId === orderId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  async create(shipment: NewShipment): Promise<Shipment> {
    const now = new Date().toISOString();
    const created: Shipment = {
      id: crypto.randomUUID(),
      orderId: shipment.orderId,
      courier: shipment.courier,
      consignmentId: shipment.consignmentId,
      trackingCode: shipment.trackingCode,
      status: shipment.status,
      rawStatus: shipment.rawStatus,
      codAmount: shipment.codAmount,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      deliveredAt: null,
    };
    memory.set(created.id, created);
    return created;
  }

  async apply(event: StatusEvent): Promise<ApplyResult> {
    if (memoryEvents.has(`${event.courier}:${event.eventKey}`)) {
      return {
        duplicate: true,
        changed: false,
        orderReference: null,
        previousStatus: null,
        newStatus: event.status,
      };
    }
    memoryEvents.add(`${event.courier}:${event.eventKey}`);

    const shipment = [...memory.values()]
      .filter(
        (candidate) =>
          candidate.courier === event.courier &&
          ((event.consignmentId && candidate.consignmentId === event.consignmentId) ||
            (event.trackingCode && candidate.trackingCode === event.trackingCode)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (!shipment) {
      return {
        duplicate: false,
        changed: false,
        orderReference: null,
        previousStatus: null,
        newStatus: event.status,
      };
    }

    const previous = shipment.status;
    const stale =
      (RANK[event.status] > 0 && RANK[previous] > RANK[event.status]) ||
      (event.status === "unknown" && previous !== "unknown");

    shipment.rawStatus = event.rawStatus ?? shipment.rawStatus;
    shipment.lastSyncedAt = new Date().toISOString();

    if (!stale) {
      shipment.status = event.status;
      shipment.updatedAt = shipment.lastSyncedAt;
      if (
        (event.status === "delivered" || event.status === "cod_collected") &&
        !shipment.deliveredAt
      ) {
        shipment.deliveredAt = shipment.lastSyncedAt;
      }
    }

    return {
      duplicate: false,
      changed: !stale && previous !== event.status,
      orderReference: null,
      previousStatus: previous,
      newStatus: stale ? previous : event.status,
    };
  }

  async saveRisk(_profile: RiskProfile): Promise<void> {
    /* Nothing to cache into. The push logs the profile either way. */
  }
}

let cached: ShipmentStore | null = null;

export function shipments(): ShipmentStore {
  if (cached) return cached;
  cached =
    erpEnv.configured && !erpEnv.forceMock
      ? new SupabaseShipmentStore()
      : new MemoryShipmentStore();
  return cached;
}
