import { NextResponse } from "next/server";
import { steadfastEnv } from "@/lib/env";
import { courier } from "@/lib/courier";
import { applyCourierEvent } from "@/lib/courier/dispatch";
import { safeEqual } from "@/lib/crypto";

/*
 * Steadfast's delivery-status webhook.
 *
 * Configured in their portal against a URL and a bearer token; they POST here
 * whenever a consignment changes and expect a 200 back.
 *
 * Auth is the token, compared in constant time. Getting this wrong is not a
 * theoretical problem: an open endpoint here lets anyone mark any order
 * delivered, which in a COD business means telling the owner that money has
 * been collected when it has not. There is no development fallback — with
 * STEADFAST_WEBHOOK_TOKEN unset the route refuses everything.
 *
 * Payload fields, from their docs: consignment_id, invoice, status (or
 * delivery_status, which appears on some events), cod_amount, updated_at.
 */
export const dynamic = "force-dynamic";

type Payload = {
  consignment_id?: number | string;
  invoice?: string;
  tracking_code?: string;
  status?: string;
  delivery_status?: string;
  cod_amount?: number | string;
  updated_at?: string;
  notification_type?: string;
};

function unauthorised() {
  /*
   * A bare 401 with no detail. An error that distinguished "no token" from
   * "wrong token" would be a probing oracle, and Steadfast does not read the
   * body anyway.
   */
  return NextResponse.json({ status: 401 }, { status: 401 });
}

export async function POST(request: Request) {
  const expected = steadfastEnv.webhookToken;
  if (!expected) {
    console.error(
      "[steadfast webhook] STEADFAST_WEBHOOK_TOKEN is not set; refusing every callback.",
    );
    return unauthorised();
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.replace(/^Bearer\s+/i, "");
  if (!presented || !safeEqual(presented, expected)) {
    return unauthorised();
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ status: 400, message: "Invalid JSON" }, { status: 400 });
  }

  const raw = payload.delivery_status ?? payload.status ?? null;
  const consignmentId =
    payload.consignment_id != null ? String(payload.consignment_id) : null;

  if (!raw || (!consignmentId && !payload.invoice && !payload.tracking_code)) {
    /*
     * 200, not 400. Steadfast retries a non-2xx, and retrying a payload we
     * will never understand just fills their queue and our logs. Recorded and
     * dropped is the honest handling.
     */
    console.warn("[steadfast webhook] unusable payload", payload);
    return NextResponse.json({ status: 200, message: "Ignored" });
  }

  try {
    const result = await applyCourierEvent({
      courier: "steadfast",
      status: courier("steadfast").normalise(raw),
      rawStatus: raw,
      consignmentId,
      trackingCode: payload.tracking_code ?? null,
      /* Steadfast echoes our reference back as the invoice, which is how an
         event still lands if we never stored their consignment id. */
      reference: payload.invoice ?? null,
      /*
       * The idempotency key. Their own timestamp is in it, so a genuine second
       * change to the same status is a new event while a retry of the same one
       * is not.
       */
      eventKey: [
        consignmentId ?? payload.invoice ?? payload.tracking_code,
        raw,
        payload.updated_at ?? "",
      ].join(":"),
      source: "webhook",
    });

    if (result.duplicate) {
      console.info(`[steadfast webhook] replay ignored (${raw})`);
    } else if (!result.changed) {
      console.warn(
        `[steadfast webhook] nothing changed for ${consignmentId ?? payload.invoice} (${raw})`,
      );
    }

    /* Their docs ask for {"status": 200}, so give them exactly that. */
    return NextResponse.json({ status: 200 });
  } catch (error) {
    /*
     * A 500 here is deliberate: our database was unreachable, the event is
     * real, and Steadfast retrying it is exactly what we want.
     */
    console.error("[steadfast webhook] failed to apply", error);
    return NextResponse.json({ status: 500 }, { status: 500 });
  }
}

/** A GET so the URL can be pasted into a browser to check it is wired up. */
export async function GET() {
  return NextResponse.json({
    status: 200,
    message: "Steadfast delivery-status webhook. POST only.",
    configured: Boolean(steadfastEnv.webhookToken),
  });
}
