import { NextResponse } from "next/server";
import { adminEnv } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { pushOrderToCourier } from "@/lib/courier/dispatch";
import { COURIERS, type CourierKey } from "@/lib/orders/types";

/*
 * One tap: push an order to a courier.
 *
 * This is the brief's one-tap push, as the endpoint underneath it. Phase 6's
 * admin screen is a button that calls this; until then the owner can put it in
 * an iOS/Android shortcut, or use `node scripts/ship.mjs HQ-01042`.
 *
 *   POST /api/admin/orders/HQ-01042/ship
 *   Authorization: Bearer $ADMIN_TOKEN
 *   { "courier": "steadfast" }        // optional; defaults to the order's
 *                                    // preference, then COURIER_DEFAULT
 *
 * Auth is a bearer token with NO fallback in any environment. Everything this
 * endpoint does is irreversible and outward-facing — it hands a customer's
 * name, phone and home address to a third party and commits us to a delivery
 * charge — so it does not work at all until a token is set.
 */
export const dynamic = "force-dynamic";

function authorise(request: Request) {
  if (!adminEnv.configured) return false;
  const presented = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  return Boolean(presented) && safeEqual(presented, adminEnv.token!);
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/admin/orders/[reference]/ship">,
) {
  if (!authorise(request)) {
    if (!adminEnv.configured) {
      console.error("[admin] ADMIN_TOKEN is not set; the ship endpoint is closed.");
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reference } = await params;

  /* An empty body is the normal case — the courier comes from the order. */
  const body = (await request.json().catch(() => ({}))) as {
    courier?: string;
  };
  const requested = body.courier;
  if (requested && !(requested in COURIERS)) {
    return NextResponse.json(
      { error: `Unknown courier "${requested}".` },
      { status: 400 },
    );
  }

  const result = await pushOrderToCourier(reference, {
    courier: (requested as CourierKey | undefined) ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryable: result.retryable, existing: result.existing },
      /*
       * 409, not 400, when it is already shipped: the request was well formed
       * and the answer is "that already happened". A retry-safe failure is a
       * 503 so a shortcut or a script can tell the two apart without parsing
       * the message.
       */
      { status: result.existing ? 409 : result.retryable ? 503 : 422 },
    );
  }

  return NextResponse.json({
    reference: result.reference,
    courier: result.shipment.courier,
    consignmentId: result.shipment.consignmentId,
    trackingCode: result.shipment.trackingCode,
    status: result.shipment.status,
    codAmount: result.shipment.codAmount,
    /* Surfaced, never enforced — see pushOrderToCourier. */
    riskNote: result.riskNote,
    demo: result.demo,
  });
}
