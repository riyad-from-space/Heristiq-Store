import "server-only";
import { pathaoEnv } from "@/lib/env";
import {
  CourierError,
  type CourierProvider,
  type CreatedShipment,
  type PriceQuote,
  type RiskProfile,
  type ShipmentRef,
  type ShipmentRequest,
  type TrackingSnapshot,
} from "@/lib/courier/provider";
import type { CourierStatus } from "@/lib/courier/status";
import {
  matchArea,
  matchCity,
  matchZone,
  type PathaoArea,
  type PathaoCity,
  type PathaoZone,
  type ResolvedLocation,
} from "@/lib/courier/pathao-locations";
import { shipments } from "@/lib/courier/store";
import { devStore } from "@/lib/dev-store";

/*
 * Pathao Courier — the courier this business uses.
 *
 * Two things make this longer than the Steadfast provider, and both are
 * Pathao's design rather than incidental:
 *
 *  1. OAuth. Every call needs a bearer token from issue-token, which expires.
 *     The token is cached across requests because their issue-token endpoint
 *     is rate limited and the condition that matters is several orders being
 *     pushed at once.
 *  2. Pathao does not accept an address. It accepts a city id, a zone id and
 *     an area id from its own taxonomy, so an address has to be resolved
 *     against three list endpoints before an order can be created. The
 *     matching lives in pathao-locations.ts (pure, and tested against
 *     fixtures); the caching lives here.
 *
 * Endpoints, all under /aladdin/api/v1 unless noted:
 *   POST issue-token
 *   GET  countries/1/city-list
 *   GET  cities/{city_id}/zone-list
 *   GET  zones/{zone_id}/area-list
 *   POST orders                          create
 *   GET  orders/{consignment_id}         status
 *   POST merchant/price-plan             fee quote
 *   POST api/v1/user/success             delivery history — on
 *                                        merchant.pathao.com, not the API host
 */

const NORMAL_DELIVERY = 48;
const ON_DEMAND_DELIVERY = 12;
const ITEM_TYPE_PARCEL = 2;

/** merchant.pathao.com, not api-hermes — the success-rate call lives there. */
const MERCHANT_HOST = "https://merchant.pathao.com";

/*
 * Pathao's order_status vocabulary, mapped onto ours.
 *
 * Taken from Pathao's own WooCommerce plugin, which is the authoritative list
 * of what they actually send.
 *
 * Two mappings worth defending:
 *   Pickup_Failed / Pickup_Cancelled → on_hold, not returned. The parcel never
 *     left our hands, so nothing is coming back; someone has to rebook it, and
 *     that is the owner's action.
 *   Payment_Invoice → cod_collected. It means Pathao has settled the cash with
 *     us, which is the milestone that closes an order in the ERP.
 */
const STATUS_MAP: Record<string, CourierStatus> = {
  order_created: "pickup_scheduled",
  order_updated: "pickup_scheduled",
  pickup_requested: "pickup_scheduled",
  assigned_for_pickup: "pickup_scheduled",
  picked: "picked_up",
  pickup_failed: "on_hold",
  pickup_cancelled: "on_hold",
  at_the_sorting_hub: "in_transit",
  in_transit: "in_transit",
  received_at_last_mile_hub: "in_transit",
  assigned_for_delivery: "out_for_delivery",
  delivered: "delivered",
  partial_delivery: "on_hold",
  delivery_failed: "on_hold",
  on_hold: "on_hold",
  return: "returned",
  returned: "returned",
  paid_return: "returned",
  exchange: "on_hold",
  payment_invoice: "cod_collected",
  cancelled: "cancelled",
  lost: "lost",
};

/**
 * Pathao's webhook `event` names, for the events that carry no order_status.
 *
 * Their webhook sends `event` always and `order_status` sometimes, so the route
 * falls back to this. Exported because the webhook route needs it and must not
 * keep its own copy.
 */
export const EVENT_STATUS_MAP: Record<string, string> = {
  "order.created": "Order_Created",
  "order.updated": "Order_Updated",
  "order.pickup-requested": "Pickup_Requested",
  "order.assigned-for-pickup": "Assigned_for_Pickup",
  "order.picked": "Picked",
  "order.pickup-failed": "Pickup_Failed",
  "order.pickup-cancelled": "Pickup_Cancelled",
  "order.at-the-sorting-hub": "At_the_Sorting_HUB",
  "order.in-transit": "In_Transit",
  "order.received-at-last-mile-hub": "Received_at_Last_Mile_HUB",
  "order.assigned-for-delivery": "Assigned_for_Delivery",
  "order.delivered": "Delivered",
  "order.partial-delivery": "Partial_Delivery",
  "order.returned": "Return",
  "order.delivery-failed": "Delivery_Failed",
  "order.on-hold": "On_Hold",
  "order.paid-return": "paid_return",
  "order.exchanged": "exchange",
  "order.paid": "Payment_Invoice",
};

/*
 * The token, and the location lists, cached across requests.
 *
 * On globalThis rather than in module scope so the push route and any other
 * entry point share one cache — see lib/dev-store.ts for why module scope is
 * not enough. In production on Workers a new isolate starts cold, which is
 * fine: the cost is one issue-token and one city-list on the first push that
 * isolate handles, and the zone mapping it resolves is written to Postgres.
 */
type Cache = {
  token: { value: string; expiresAt: number } | null;
  cities: PathaoCity[] | null;
  zones: Map<number, PathaoZone[]>;
  areas: Map<number, PathaoArea[]>;
};

const cache = devStore(
  "pathao:cache",
  (): Cache => ({ token: null, cities: null, zones: new Map(), areas: new Map() }),
);

/** Pathao wraps every list as { data: { data: [...] } }. */
type Envelope<T> = {
  message?: string;
  type?: string;
  code?: number;
  data?: T;
  errors?: Record<string, string[]>;
};

export class PathaoProvider implements CourierProvider {
  readonly key = "pathao" as const;
  readonly label = "Pathao";

  get configured() {
    return pathaoEnv.configured;
  }

  private get base() {
    return pathaoEnv.baseUrl.replace(/\/$/, "");
  }

  /**
   * A valid access token, cached until a minute before it expires.
   *
   * The minute of headroom is so a token cannot expire between being read and
   * being used on a slow request.
   */
  private async token(): Promise<string> {
    const cached = cache.token;
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    if (!this.configured) {
      throw new CourierError(this.key, "Pathao credentials are not configured.");
    }

    const body = await this.request<{
      access_token?: string;
      expires_in?: number;
    }>("aladdin/api/v1/issue-token", {
      method: "POST",
      auth: false,
      body: {
        client_id: pathaoEnv.clientId,
        client_secret: pathaoEnv.clientSecret,
        username: pathaoEnv.username,
        password: pathaoEnv.password,
        grant_type: "password",
      },
    });

    /* issue-token answers at the top level, not inside `data`. */
    const token =
      body.access_token ??
      (body.data as { access_token?: string } | undefined)?.access_token;

    if (!token) {
      throw new CourierError(
        this.key,
        "Pathao issued no access token — check PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME and PATHAO_PASSWORD.",
      );
    }

    const ttl = Math.max(60, (body.expires_in ?? 3600) - 60);
    cache.token = { value: token, expiresAt: Date.now() + ttl * 1000 };
    return token;
  }

  private async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST";
      body?: unknown;
      auth?: boolean;
      host?: string;
    } = {},
  ): Promise<Envelope<T> & { access_token?: string; expires_in?: number }> {
    const method = options.method ?? "GET";
    const host = options.host ?? this.base;
    const url = `${host}/${path}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (options.auth !== false) {
      headers.Authorization = `Bearer ${await this.token()}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (cause) {
      /* A failed POST may still have created a consignment, and a blind retry
         would mean two riders at one door. See CourierError. */
      throw new CourierError(this.key, `Pathao is unreachable: ${String(cause)}`, {
        retryable: method === "GET",
        uncertain: method === "POST",
      });
    }

    const text = await response.text();
    let body: (Envelope<T> & { access_token?: string }) | null = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new CourierError(
        this.key,
        `Pathao returned a non-JSON response (${response.status}): ${text.slice(0, 160)}`,
        {
          retryable: response.status >= 500,
          uncertain: method === "POST" && response.status >= 500,
          status: response.status,
        },
      );
    }

    if (!response.ok) {
      /*
       * Pathao's 422 puts the useful part in `errors`, keyed by field —
       * "recipient_zone: The selected recipient zone is invalid" is the
       * difference between a five-minute fix and an afternoon.
       */
      const detail = body?.errors
        ? Object.entries(body.errors)
            .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
            .join("; ")
        : (body?.message ?? text.slice(0, 200));

      throw new CourierError(this.key, `Pathao rejected the request: ${detail}`, {
        retryable: response.status >= 500 || response.status === 429,
        /* A 4xx means they read it and said no, so nothing was created. */
        uncertain: method === "POST" && response.status >= 500,
        status: response.status,
      });
    }

    return body ?? {};
  }

  /** Pathao nests list payloads one level deeper than everything else. */
  private async list<T>(path: string): Promise<T[]> {
    const body = await this.request<{ data?: T[] }>(path);
    return body.data?.data ?? [];
  }

  private async cities(): Promise<PathaoCity[]> {
    cache.cities ??= await this.list<PathaoCity>(
      "aladdin/api/v1/countries/1/city-list",
    );
    return cache.cities;
  }

  private async zones(cityId: number): Promise<PathaoZone[]> {
    const existing = cache.zones.get(cityId);
    if (existing) return existing;
    const zones = await this.list<PathaoZone>(
      `aladdin/api/v1/cities/${cityId}/zone-list`,
    );
    cache.zones.set(cityId, zones);
    return zones;
  }

  private async areas(zoneId: number): Promise<PathaoArea[]> {
    const existing = cache.areas.get(zoneId);
    if (existing) return existing;
    const areas = await this.list<PathaoArea>(
      `aladdin/api/v1/zones/${zoneId}/area-list`,
    );
    cache.areas.set(zoneId, areas);
    return areas;
  }

  /**
   * District + area → Pathao's three ids.
   *
   * The stored mapping wins over a fresh match, and a `manual` one wins over
   * everything: someone who has corrected a zone once should not have it
   * re-guessed. A new resolution is cached on the way out.
   */
  async resolveDestination(
    district: string,
    area: string | null,
  ): Promise<ResolvedLocation> {
    const store = shipments();

    const cached = await store.zoneFor(this.key, district, area);
    if (cached) {
      return {
        cityId: cached.cityId,
        cityName: cached.cityName ?? district,
        zoneId: cached.zoneId,
        zoneName: cached.zoneName ?? (area ?? ""),
        areaId: cached.areaId,
        areaName: cached.areaName,
        match: cached.source === "manual" ? "manual" : "exact",
      };
    }

    /*
     * City first, because the zone list is per city — so one address costs a
     * city-list call (cached), one zone-list call, and one area-list call at
     * most, rather than a walk through their whole taxonomy.
     */
    const cities = await this.cities();
    const city = matchCity(district, cities);

    if (!city) {
      throw new CourierError(
        this.key,
        `Pathao has no city matching the district "${district}". They may not deliver there.`,
      );
    }

    /*
     * Pathao needs a zone, and with no area there is nothing to match one on.
     * Guessing would put the parcel in a random thana of the right city — a
     * real delivery failure that looks like a successful push — so this
     * refuses and says what would fix it.
     */
    if (!area?.trim()) {
      throw new CourierError(
        this.key,
        `${city.item.city_name} has many Pathao zones and this order has no area, so the ` +
          `thana cannot be determined. Ask the customer for their area, or add a default ` +
          `zone for this district to storefront_courier_zones.`,
      );
    }

    const zones = await this.zones(city.item.city_id);
    const zone = matchZone(area, zones);

    if (!zone) {
      throw new CourierError(
        this.key,
        `No Pathao zone in ${city.item.city_name} matches the area "${area}". ` +
          `Pick the right one from their zone list and add it to storefront_courier_zones ` +
          `with source='manual'.`,
      );
    }

    /*
     * Area is the finest level, the least reliable, and optional to Pathao —
     * so a miss costs the rider a slightly less precise hint and nothing else.
     * The written address still carries the detail.
     */
    let areaId: number | null = null;
    let areaName: string | null = null;
    try {
      const areaList = await this.areas(zone.item.zone_id);
      const areaMatch = areaList.length > 0 ? matchArea(area, areaList) : null;
      areaId = areaMatch?.item.area_id ?? null;
      areaName = areaMatch?.item.area_name ?? null;
    } catch (error) {
      console.warn("[pathao] area list unavailable, sending without it", error);
    }

    const location: ResolvedLocation = {
      cityId: city.item.city_id,
      cityName: city.item.city_name,
      zoneId: zone.item.zone_id,
      zoneName: zone.item.zone_name,
      areaId,
      areaName,
      /* The weakest link decides how much the whole resolution is trusted. */
      match:
        city.match === "fuzzy" || zone.match === "fuzzy"
          ? "fuzzy"
          : city.match === "alias" || zone.match === "alias"
            ? "alias"
            : "exact",
    };

    await store.saveZone(this.key, district, area, {
      cityId: location.cityId,
      cityName: location.cityName,
      zoneId: location.zoneId,
      zoneName: location.zoneName,
      areaId: location.areaId,
      areaName: location.areaName,
    });

    return location;
  }

  normalise(raw: string): CourierStatus {
    /* Pathao is inconsistent across endpoints: Pickup_Requested,
       pickup_requested and "Pickup Requested" have all been seen, and the
       webhook sends event names like order.pickup-requested. */
    const direct = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (STATUS_MAP[direct]) return STATUS_MAP[direct];

    const viaEvent = EVENT_STATUS_MAP[raw?.trim().toLowerCase()];
    if (viaEvent) {
      return STATUS_MAP[viaEvent.toLowerCase().replace(/[\s-]+/g, "_")] ?? "unknown";
    }

    return "unknown";
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    if (!pathaoEnv.storeId) {
      throw new CourierError(
        this.key,
        "PATHAO_STORE_ID is not set. List your stores with scripts/courier-check.mjs and put the id in the environment.",
      );
    }

    /* Resolved BEFORE the order call, so an address Pathao cannot route is a
       clear refusal rather than a 422 buried in their validation errors. */
    const location = await this.resolveDestination(request.district, request.area);

    const body = await this.request<{
      consignment_id?: string;
      merchant_order_id?: string;
      order_status?: string;
      delivery_fee?: number | string;
    }>("aladdin/api/v1/orders", {
      method: "POST",
      body: {
        store_id: Number(pathaoEnv.storeId),
        merchant_order_id: request.reference,
        sender_name: pathaoEnv.senderName,
        sender_phone: pathaoEnv.senderPhone,
        recipient_name: request.recipientName,
        recipient_phone: request.recipientPhone,
        /* Pathao requires at least 10 characters here, which the checkout
           already enforces (see lib/orders/schema.ts). */
        recipient_address: request.recipientAddress,
        recipient_city: location.cityId,
        recipient_zone: location.zoneId,
        ...(location.areaId !== null && { recipient_area: location.areaId }),
        delivery_type:
          request.deliveryType === "hub" ? ON_DEMAND_DELIVERY : NORMAL_DELIVERY,
        item_type: ITEM_TYPE_PARCEL,
        item_quantity: request.totalLot,
        item_weight: pathaoEnv.itemWeight,
        item_description: request.itemDescription ?? "",
        amount_to_collect: request.codAmount,
        special_instruction: request.note ?? "",
      },
    });

    const data = body.data;
    if (!data?.consignment_id) {
      throw new CourierError(
        this.key,
        "Pathao accepted the order but returned no consignment id.",
        { uncertain: true },
      );
    }

    const raw = data.order_status ?? null;

    return {
      consignmentId: String(data.consignment_id),
      /* Pathao has no separate tracking code — the consignment id is what a
         customer pastes into their tracking page. */
      trackingCode: String(data.consignment_id),
      status: raw ? this.normalise(raw) : "pickup_scheduled",
      rawStatus: raw,
      courierFee:
        data.delivery_fee != null ? Math.round(Number(data.delivery_fee)) : null,
      location: {
        courier: "pathao",
        city: { id: location.cityId, name: location.cityName },
        zone: { id: location.zoneId, name: location.zoneName },
        area: location.areaId ? { id: location.areaId, name: location.areaName } : null,
        /* How the mapping was arrived at. `fuzzy` is the one worth reviewing
           if a parcel goes astray. */
        match: location.match,
      },
    };
  }

  async track(ref: ShipmentRef): Promise<TrackingSnapshot> {
    const id = ref.consignmentId ?? ref.trackingCode;
    if (!id) {
      throw new CourierError(this.key, "No Pathao consignment id to track by.");
    }

    const body = await this.request<{
      order_status?: string;
      updated_at?: string;
      delivery_fee?: number | string;
    }>(`aladdin/api/v1/orders/${encodeURIComponent(id)}`);

    const raw = body.data?.order_status ?? null;
    return {
      status: raw ? this.normalise(raw) : "unknown",
      rawStatus: raw,
      updatedAt: body.data?.updated_at ?? null,
    };
  }

  async priceQuote(
    request: Pick<ShipmentRequest, "codAmount" | "deliveryType"> &
      Partial<Pick<ShipmentRequest, "district" | "area">>,
  ): Promise<PriceQuote> {
    if (!pathaoEnv.storeId) {
      throw new CourierError(this.key, "PATHAO_STORE_ID is not set.");
    }
    if (!request.district) {
      throw new CourierError(
        this.key,
        "A district is needed to quote a Pathao price.",
      );
    }

    const location = await this.resolveDestination(
      request.district,
      request.area ?? null,
    );

    const body = await this.request<{
      price?: number | string;
      final_price?: number | string;
    }>("aladdin/api/v1/merchant/price-plan", {
      method: "POST",
      body: {
        store_id: Number(pathaoEnv.storeId),
        item_type: ITEM_TYPE_PARCEL,
        delivery_type:
          request.deliveryType === "hub" ? ON_DEMAND_DELIVERY : NORMAL_DELIVERY,
        item_weight: pathaoEnv.itemWeight,
        recipient_city: location.cityId,
        recipient_zone: location.zoneId,
      },
    });

    const fee = body.data?.final_price ?? body.data?.price ?? 0;
    return { fee: Math.round(Number(fee)) };
  }

  async riskCheck(phone: string): Promise<RiskProfile | null> {
    /*
     * Advisory: every failure returns null rather than throwing, so Pathao's
     * success-rate endpoint being down, moved or not enabled for this account
     * can never stop a parcel going out.
     *
     * Note the host — this one lives on merchant.pathao.com and is not under
     * /aladdin, unlike everything else here.
     */
    try {
      const body = await this.request<{
        customer?: {
          total_delivery?: number | string;
          successful_delivery?: number | string;
          cancelled_delivery?: number | string;
          success_rate?: number | string;
        };
      }>("api/v1/user/success", {
        method: "POST",
        host: MERCHANT_HOST,
        body: { phone },
      });

      const customer = body.data?.customer;
      if (!customer) return null;

      const total = Number(customer.total_delivery ?? 0);
      const delivered = Number(customer.successful_delivery ?? 0);
      const cancelled = Number(
        customer.cancelled_delivery ?? Math.max(0, total - delivered),
      );
      const ratio =
        customer.success_rate != null
          ? Number(customer.success_rate)
          : total > 0
            ? Math.round((delivered / total) * 100)
            : null;

      if (!Number.isFinite(total)) return null;

      return {
        phone,
        totalParcels: total,
        delivered: Number.isFinite(delivered) ? delivered : 0,
        cancelled: Number.isFinite(cancelled) ? cancelled : 0,
        successRatio: ratio !== null && Number.isFinite(ratio) ? ratio : null,
        source: this.key,
      };
    } catch (error) {
      console.warn("[pathao] success-rate check unavailable", error);
      return null;
    }
  }

  /** Our stores on Pathao's side. Used by scripts/courier-check.mjs. */
  async stores(): Promise<{ store_id: number; store_name: string }[]> {
    return this.list<{ store_id: number; store_name: string }>(
      "aladdin/api/v1/stores",
    );
  }
}
