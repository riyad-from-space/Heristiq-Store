"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminState } from "@/lib/admin";
import type { StorefrontOrderStatus } from "@/lib/store-types";

/*
 * What the owner can do to a storefront order.
 *
 * Every action re-checks admin status. A server action is a public POST
 * endpoint, and the layout's guard protects the PAGE, not the action — a
 * non-admin who never renders the page can still call this. The database's
 * RLS would refuse them too, but a silent no-op from RLS is a worse experience
 * than an explicit refusal, and defence in depth is the point.
 *
 * Deliberately NOT here: anything that moves stock. That is post_sale()'s job
 * on the ERP side, reached through the normal sale flow — a storefront order
 * becomes stock movement only when it is converted to a sale.
 */

async function guard() {
  const admin = await adminState();
  if (!admin?.isAdmin) throw new Error("Not authorised.");
  return admin;
}

export async function setOrderStatus(formData: FormData): Promise<void> {
  await guard();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as StorefrontOrderStatus;
  const allowed: StorefrontOrderStatus[] = [
    "placed",
    "confirmed",
    "packed",
    "handed_to_courier",
    "delivered",
    "cancelled",
    "returned",
  ];
  if (!id || !allowed.includes(status)) return;

  const supabase = await createClient();
  await supabase.from("storefront_orders").update({ status }).eq("id", id);

  /* The audit trail is the only record of who changed what, and the customer
     may ask. Same table the courier webhooks write to. */
  await supabase.from("storefront_order_events").insert({
    order_id: id,
    kind: "status_changed",
    detail: { to: status, source: "erp" },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

/**
 * Confirm a manual bKash/Nagad advance.
 *
 * The customer typed a transaction id; the owner checks it in their own bKash
 * app and presses this. Nothing automatic — verifying a trxID against bKash
 * requires a merchant API this business does not have, and pretending
 * otherwise would mark money received that was not.
 */
export async function verifyAdvance(formData: FormData): Promise<void> {
  await guard();

  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!id || !Number.isFinite(amount) || amount < 0) return;

  const supabase = await createClient();
  await supabase
    .from("storefront_orders")
    .update({ amount_paid: amount, payment_state: "advance_verified" })
    .eq("id", id);

  await supabase.from("storefront_order_events").insert({
    order_id: id,
    kind: "advance_verified",
    detail: { amount, source: "erp" },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

export async function rejectAdvance(formData: FormData): Promise<void> {
  await guard();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("storefront_orders")
    .update({ amount_paid: 0, payment_state: "due_on_delivery" })
    .eq("id", id);

  await supabase.from("storefront_order_events").insert({
    order_id: id,
    kind: "advance_rejected",
    detail: { source: "erp" },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

/**
 * Hand the parcel to a courier.
 *
 * Calls the storefront's own push endpoint rather than reimplementing it: the
 * double-send guard, the address resolution, the risk check and the shipment
 * record all live there (apps/store/src/lib/courier/dispatch.ts), and a second
 * implementation would be a second set of bugs. One tap, as the brief asked.
 */
export async function pushToCourier(
  formData: FormData,
): Promise<string | null> {
  await guard();

  const reference = String(formData.get("reference") ?? "");
  const courier = String(formData.get("courier") ?? "");
  if (!reference) return "No order reference.";

  const base = process.env.STOREFRONT_URL;
  const token = process.env.ADMIN_TOKEN;

  if (!base || !token) {
    return (
      "Courier push is not configured. Set STOREFRONT_URL and ADMIN_TOKEN " +
      "for the ERP so it can reach the storefront's push endpoint."
    );
  }

  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/admin/orders/${encodeURIComponent(reference)}/ship`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(courier ? { courier } : {}),
        /* A courier API can be slow; a hung fetch must not hang the page. */
        signal: AbortSignal.timeout(30_000),
      },
    );

    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      trackingCode?: string;
      riskNote?: string;
    };

    if (!response.ok) return body.error ?? `Push failed (${response.status}).`;

    revalidatePath("/orders");
    return body.riskNote ? `Shipped. Note: ${body.riskNote}` : null;
  } catch (error) {
    return `Could not reach the storefront: ${String(error)}`;
  }
}

export async function markMessageHandled(formData: FormData): Promise<void> {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("storefront_messages")
    .update({ handled_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/messages");
}
