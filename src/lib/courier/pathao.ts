import "server-only";
import { pathaoEnv } from "@/lib/env";
import {
  CourierError,
  CourierNotImplemented,
  type CourierProvider,
  type CreatedShipment,
  type RiskProfile,
  type ShipmentRef,
  type ShipmentRequest,
  type TrackingSnapshot,
} from "@/lib/courier/provider";
import type { CourierStatus } from "@/lib/courier/status";

/*
 * Pathao — a stub behind the interface, with the two parts that are actually
 * hard already done: the OAuth token cache, and the status vocabulary.
 *
 * Why not finish it: Pathao's create-order needs a store_id and a
 * city/zone/area id triple from THEIR taxonomy, which means either an address
 * cascade driven by their API instead of ours (lib/bd-geo.ts) or a mapping
 * table between the two. That is a real piece of work with a real design
 * decision in it, and doing it speculatively — before this business has a
 * Pathao merchant account, whose approval also decides the shape of the
 * store_id — would be guessing.
 *
 * What is NOT deferred is the seam. `courier("pathao")` resolves, reports
 * itself unconfigured, and throws a legible CourierNotImplemented rather than
 * a TypeError. Finishing it means implementing two methods in this file.
 *
 * The documented shape, so the next person does not have to go looking:
 *
 *   POST /aladdin/api/v1/issue-token
 *        { client_id, client_secret, username, password, grant_type: "password" }
 *        → { access_token, refresh_token, expires_in }
 *   GET  /aladdin/api/v1/city-list
 *   GET  /aladdin/api/v1/cities/{city_id}/zone-list
 *   GET  /aladdin/api/v1/zones/{zone_id}/area-list
 *   POST /aladdin/api/v1/orders
 *        { store_id, merchant_order_id, recipient_name, recipient_phone,
 *          recipient_address, recipient_city, recipient_zone, recipient_area,
 *          delivery_type: 48 | 12,   // 48 = normal, 12 = on-demand
 *          item_type: 2,             // 2 = parcel
 *          item_quantity, item_weight, amount_to_collect, special_instruction }
 *        → { consignment_id, merchant_order_id, order_status, delivery_fee }
 *   POST /aladdin/api/v1/merchant/price-plan       → delivery fee quote
 *   GET  /aladdin/api/v1/user/success              → success rate by phone
 *
 * All calls carry `Authorization: Bearer <access_token>`.
 */

const STATUS_MAP: Record<string, CourierStatus> = {
  pending: "pickup_scheduled",
  pickup_requested: "pickup_scheduled",
  assigned_for_pickup: "pickup_scheduled",
  picked: "picked_up",
  pickup: "picked_up",
  at_the_sorting_hub: "in_transit",
  in_transit: "in_transit",
  received_at_last_mile_hub: "in_transit",
  assigned_for_delivery: "out_for_delivery",
  delivered: "delivered",
  partial_delivery: "on_hold",
  on_hold: "on_hold",
  return: "returned",
  returned: "returned",
  delivery_failed: "on_hold",
  cancelled: "cancelled",
  lost: "lost",
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
};

/*
 * Module-scoped, so one token is shared by every request this instance serves
 * rather than one issued per order push. Pathao's tokens last hours and their
 * issue-token endpoint is rate limited.
 */
let token: { value: string; expiresAt: number } | null = null;

export class PathaoProvider implements CourierProvider {
  readonly key = "pathao" as const;
  readonly label = "Pathao";

  get configured() {
    return pathaoEnv.configured;
  }

  normalise(raw: string): CourierStatus {
    /* Pathao mixes cases and separators across endpoints — Pickup_Requested,
       pickup_requested, "Pickup Requested" have all been seen. */
    const key = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return STATUS_MAP[key] ?? "unknown";
  }

  /**
   * A valid access token, cached until a minute before it expires.
   *
   * Implemented rather than stubbed because it is the part that is easy to get
   * subtly wrong — an uncached token issued per call gets rate limited under
   * the one condition that matters, which is several orders being pushed at
   * once.
   */
  async accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now()) return token.value;

    if (!this.configured) {
      throw new CourierError(this.key, "Pathao credentials are not configured.");
    }

    const response = await fetch(
      `${pathaoEnv.baseUrl.replace(/\/$/, "")}/aladdin/api/v1/issue-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: pathaoEnv.clientId,
          client_secret: pathaoEnv.clientSecret,
          username: pathaoEnv.username,
          password: pathaoEnv.password,
          grant_type: "password",
        }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );

    const body = (await response.json().catch(() => null)) as TokenResponse | null;
    if (!response.ok || !body?.access_token) {
      throw new CourierError(this.key, "Pathao refused the credentials.", {
        retryable: response.status >= 500,
        status: response.status,
      });
    }

    token = {
      value: body.access_token,
      /* A minute of headroom, so a token cannot expire mid-flight. */
      expiresAt: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 60) * 1000,
    };
    return token.value;
  }

  async createShipment(_request: ShipmentRequest): Promise<CreatedShipment> {
    throw new CourierNotImplemented(
      this.key,
      "createShipment — needs a store_id and a city/zone/area mapping onto lib/bd-geo.ts",
    );
  }

  async track(_ref: ShipmentRef): Promise<TrackingSnapshot> {
    throw new CourierNotImplemented(this.key, "track");
  }

  async riskCheck(_phone: string): Promise<RiskProfile | null> {
    /* GET /aladdin/api/v1/user/success. Advisory, so silence beats throwing. */
    return null;
  }
}
