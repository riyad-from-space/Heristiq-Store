import { NextResponse } from "next/server";
import { pathaoEnv } from "@/lib/env";
import { courier } from "@/lib/courier";
import { EVENT_STATUS_MAP } from "@/lib/courier/pathao";
import { applyCourierEvent } from "@/lib/courier/dispatch";
import { safeEqual } from "@/lib/crypto";

/*
 * Pathao's delivery-status webhook.
 *
 * The contract here is not guessed — it is taken from Pathao's own WooCommerce
 * plugin (github.com/pathao-eng/courier-woocommerce-plugin), which is the
 * authoritative statement of what they send and what they expect back:
 *
 *   in   POST, with `X-PATHAO-Signature` carrying your webhook secret verbatim
 *   out  HTTP 202, with the header
 *        `X-Pathao-Merchant-Webhook-Integration-Secret` set to the fixed
 *        Pathao constant below, within 10 seconds
 *
 * Two things about that response are easy to get wrong and both make the
 * integration silently fail to register:
 *   - the response header value is a CONSTANT Pathao publishes, not our secret;
 *   - the status must be 202, not 200.
 *
 * Auth is a constant-time comparison of the incoming signature. There is no
 * development fallback: an open endpoint here lets anyone mark any order
 * delivered, which in a cash-on-delivery business means reporting money
 * collected that nobody collected.
 */
export const dynamic = "force-dynamic";

/** Pathao's published integration constant. Not a secret, and not ours. */
const INTEGRATION_SECRET = "f3992ecc-59da-4cbe-a049-a13da2018d51";

type Payload = {
  event?: string;
  order_status?: string;
  consignment_id?: string;
  merchant_order_id?: string;
  delivery_fee?: number | string;
  collected_amount?: number | string;
  updated_at?: string;
  timestamp?: string;
  reason?: string;
};

/** Every reply Pathao accepts has to carry this header, including the errors. */
function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Pathao-Merchant-Webhook-Integration-Secret": INTEGRATION_SECRET,
    },
  });
}

export async function POST(request: Request) {
  const expected = pathaoEnv.webhookSecret;
  if (!expected) {
    console.error(
      "[pathao webhook] PATHAO_WEBHOOK_SECRET is not set; refusing every callback.",
    );
    return reply({ message: "Unauthorized" }, 401);
  }

  /* Their header, verbatim — not a Bearer prefix and not an HMAC. */
  const presented = request.headers.get("x-pathao-signature") ?? "";
  if (!presented || !safeEqual(presented, expected)) {
    return reply({ message: "Unauthorized" }, 401);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return reply({ message: "Invalid JSON" }, 400);
  }

  /*
   * Pathao's own integration handshake. It fires when the webhook URL is saved
   * in their dashboard and carries no order, so it must be accepted before
   * anything else is looked at — otherwise the URL never registers.
   */
  if (payload.event === "webhook_integration") {
    console.info("[pathao webhook] integration handshake accepted");
    return reply({ message: "Successfully accepted webhook_integration" }, 202);
  }

  /* order_status when they send it, the event name when they do not. */
  const raw =
    payload.order_status ??
    (payload.event ? EVENT_STATUS_MAP[payload.event] : undefined) ??
    null;

  if (!raw || (!payload.consignment_id && !payload.merchant_order_id)) {
    /*
     * 202, not 4xx. Pathao retries a non-2xx, and retrying a payload we will
     * never understand only fills their queue and our logs. Recorded and
     * dropped is the honest handling.
     */
    console.warn("[pathao webhook] unusable payload", payload);
    return reply({ message: "Ignored" }, 202);
  }

  try {
    const result = await applyCourierEvent({
      courier: "pathao",
      status: courier("pathao").normalise(raw),
      rawStatus: raw,
      consignmentId: payload.consignment_id ?? null,
      trackingCode: payload.consignment_id ?? null,
      /* Pathao echoes our reference back as merchant_order_id, which is how an
         event still lands if their consignment id was never stored. */
      reference: payload.merchant_order_id ?? null,
      /*
       * The idempotency key. Their timestamp is in it, so a genuine second
       * change to the same status is a new event while a retry of the same one
       * is not.
       */
      eventKey: [
        payload.consignment_id ?? payload.merchant_order_id,
        raw,
        payload.updated_at ?? payload.timestamp ?? "",
      ].join(":"),
      source: "webhook",
    });

    if (result.duplicate) {
      console.info(`[pathao webhook] replay ignored (${raw})`);
    } else if (!result.changed) {
      console.warn(
        `[pathao webhook] nothing changed for ${payload.consignment_id ?? payload.merchant_order_id} (${raw})`,
      );
    }

    return reply({ message: "Order status updated" }, 202);
  } catch (error) {
    /* A 500 is deliberate: our database was unreachable, the event is real,
       and Pathao retrying it is exactly what we want. */
    console.error("[pathao webhook] failed to apply", error);
    return reply({ message: "Could not apply" }, 500);
  }
}

/** A GET so the URL can be pasted into a browser to check it is wired up. */
export async function GET() {
  return NextResponse.json({
    message: "Pathao delivery-status webhook. POST only.",
    configured: Boolean(pathaoEnv.webhookSecret),
  });
}
