import "server-only";
import { steadfastEnv } from "@/lib/env";
import {
  CourierError,
  type CourierProvider,
  type CreatedShipment,
  type RiskProfile,
  type ShipmentRef,
  type ShipmentRequest,
  type TrackingSnapshot,
} from "@/lib/courier/provider";
import type { CourierStatus } from "@/lib/courier/status";

/*
 * Steadfast Courier, implemented fully.
 *
 * API v1. Auth is two headers, `Api-Key` and `Secret-Key`, on every request —
 * no OAuth, no token to refresh, which is why this provider is 200 lines and
 * Pathao's will not be.
 *
 * Endpoints used:
 *   POST create_order                     place a consignment
 *   GET  status_by_cid/{consignment_id}   the status we normally ask for
 *   GET  status_by_invoice/{invoice}      fallback when we lost the cid
 *   GET  status_by_trackingcode/{code}
 *   GET  get_balance                      credentials smoke test
 *
 * Their success envelope is `{"status": 200, ...}` in the BODY, and they are
 * not consistent about the HTTP status matching it, so both are checked. A 200
 * response carrying `{"status": 400}` is a failure.
 */

const HOME_DELIVERY = 0;
const HUB_DELIVERY = 1;

/*
 * Steadfast's delivery_status vocabulary, verbatim from their v1 docs, mapped
 * onto ours.
 *
 * The `*_approval_pending` family is the interesting one: it means the rider
 * has reported an outcome and Steadfast's office has not signed it off yet.
 * Those are mapped to the OPTIMISTIC-but-not-final reading — a delivery the
 * rider says happened shows as delivered — because that is what the customer
 * experienced, and because the alternative ("out for delivery" for a parcel
 * the customer is holding) generates support messages.
 *
 * `partial_delivered` means some of a multi-parcel consignment arrived. This
 * business ships one parcel per order, so if it ever appears it is worth the
 * owner looking, not the customer: it maps to on_hold.
 */
const STATUS_MAP: Record<string, CourierStatus> = {
  pending: "pickup_scheduled",
  in_review: "pickup_scheduled",
  hold: "on_hold",
  delivered: "delivered",
  delivered_approval_pending: "delivered",
  partial_delivered: "on_hold",
  partial_delivered_approval_pending: "on_hold",
  cancelled: "returned",
  cancelled_approval_pending: "returned",
  unknown: "unknown",
  unknown_approval_pending: "unknown",
  /*
   * Not in the documented delivery_status list, but Steadfast's create_order
   * response and their webhook both use these on the consignment itself, so
   * they arrive in practice.
   */
  in_transit: "in_transit",
  picked_up: "picked_up",
  out_for_delivery: "out_for_delivery",
  returned: "returned",
  lost: "lost",
};

type Envelope = { status?: number; message?: string };

export class SteadfastProvider implements CourierProvider {
  readonly key = "steadfast" as const;
  readonly label = "Steadfast";

  get configured() {
    return steadfastEnv.configured;
  }

  private async call<T>(
    path: string,
    init?: { method?: "GET" | "POST"; body?: unknown },
  ): Promise<T & Envelope> {
    if (!this.configured) {
      throw new CourierError(
        this.key,
        "Steadfast credentials are not configured (STEADFAST_API_KEY / STEADFAST_SECRET_KEY).",
      );
    }

    const url = `${steadfastEnv.baseUrl.replace(/\/$/, "")}/${path}`;
    const method = init?.method ?? "GET";

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Api-Key": steadfastEnv.apiKey!,
          "Secret-Key": steadfastEnv.secretKey!,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(init?.body !== undefined && { body: JSON.stringify(init.body) }),
        /*
         * 15s. Longer than Steadfast normally takes and short enough that a
         * hung courier API does not hold a Worker request open.
         */
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (cause) {
      /*
       * A network failure on a POST is the dangerous case: the consignment may
       * exist. `uncertain` tells the caller never to blind-retry it.
       */
      throw new CourierError(this.key, `Steadfast is unreachable: ${String(cause)}`, {
        retryable: method === "GET",
        uncertain: method === "POST",
      });
    }

    const text = await response.text();
    let body: (T & Envelope) | null = null;
    try {
      body = text ? (JSON.parse(text) as T & Envelope) : null;
    } catch {
      /* Steadfast answers with an HTML error page when the portal is down. */
      throw new CourierError(
        this.key,
        `Steadfast returned a non-JSON response (${response.status}): ${text.slice(0, 160)}`,
        { retryable: response.status >= 500, uncertain: method === "POST", status: response.status },
      );
    }

    /* Both layers have to agree. They do not always. */
    const ok = response.ok && (body?.status === undefined || body.status === 200);
    if (!ok || !body) {
      throw new CourierError(
        this.key,
        body?.message ??
          `Steadfast rejected the request (HTTP ${response.status}, body status ${body?.status ?? "none"}).`,
        {
          retryable: response.status >= 500 || response.status === 429,
          /* A 4xx means they read it and said no — nothing was created. */
          uncertain: method === "POST" && response.status >= 500,
          status: response.status,
        },
      );
    }

    return body;
  }

  normalise(raw: string): CourierStatus {
    return STATUS_MAP[raw?.trim().toLowerCase()] ?? "unknown";
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    const body = await this.call<{
      consignment?: {
        consignment_id?: number | string;
        tracking_code?: string;
        status?: string;
      };
    }>("create_order", {
      method: "POST",
      body: {
        invoice: request.reference,
        recipient_name: request.recipientName,
        recipient_phone: request.recipientPhone,
        recipient_address: request.recipientAddress,
        cod_amount: request.codAmount,
        note: request.note ?? "",
        item_description: request.itemDescription ?? "",
        total_lot: request.totalLot,
        delivery_type:
          request.deliveryType === "hub" ? HUB_DELIVERY : HOME_DELIVERY,
      },
    });

    const consignment = body.consignment;
    if (!consignment?.consignment_id && !consignment?.tracking_code) {
      /*
       * Accepted, but with nothing to track it by. Treated as uncertain: the
       * parcel may well be in their system, so the owner has to look rather
       * than press the button again.
       */
      throw new CourierError(
        this.key,
        "Steadfast accepted the order but returned no consignment id or tracking code.",
        { uncertain: true },
      );
    }

    const raw = consignment.status ?? null;
    return {
      consignmentId:
        consignment.consignment_id != null
          ? String(consignment.consignment_id)
          : null,
      trackingCode: consignment.tracking_code ?? null,
      /* A fresh consignment has been accepted but not collected. */
      status: raw ? this.normalise(raw) : "pickup_scheduled",
      rawStatus: raw,
    };
  }

  async track(ref: ShipmentRef): Promise<TrackingSnapshot> {
    /* Consignment id first: it is the courier's own key and the only one that
       cannot collide with anything of ours. */
    const path = ref.consignmentId
      ? `status_by_cid/${encodeURIComponent(ref.consignmentId)}`
      : ref.trackingCode
        ? `status_by_trackingcode/${encodeURIComponent(ref.trackingCode)}`
        : ref.reference
          ? `status_by_invoice/${encodeURIComponent(ref.reference)}`
          : null;

    if (!path) {
      throw new CourierError(
        this.key,
        "Nothing to track by: no consignment id, tracking code or reference.",
      );
    }

    const body = await this.call<{ delivery_status?: string }>(path);
    const raw = body.delivery_status ?? null;

    return {
      status: raw ? this.normalise(raw) : "unknown",
      rawStatus: raw,
      /* status_by_* returns a status and nothing else — no timestamp. The
         webhook does, and that is where updatedAt normally comes from. */
      updatedAt: null,
    };
  }

  async balance(): Promise<number> {
    const body = await this.call<{ current_balance?: number | string }>(
      "get_balance",
    );
    return Number(body.current_balance ?? 0);
  }

  async riskCheck(phone: string): Promise<RiskProfile | null> {
    /*
     * Advisory, and treated as such: any failure returns null rather than
     * throwing, so a courier's fraud endpoint being down, moved or renamed can
     * never stop a parcel going out. The path is configurable for the same
     * reason — see steadfastEnv.fraudCheckPath.
     */
    try {
      const path = steadfastEnv.fraudCheckPath.replace(
        "{phone}",
        encodeURIComponent(phone),
      );
      const body = await this.call<{
        total_parcels?: number | string;
        total_delivered?: number | string;
        total_cancelled?: number | string;
        success_ratio?: number | string;
      }>(path);

      const total = Number(body.total_parcels ?? 0);
      const delivered = Number(body.total_delivered ?? 0);
      const cancelled = Number(body.total_cancelled ?? 0);
      const ratio =
        body.success_ratio != null
          ? Number(body.success_ratio)
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
      console.warn("[steadfast] risk check unavailable", error);
      return null;
    }
  }
}
