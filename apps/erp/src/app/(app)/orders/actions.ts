"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
 * Recording a delivered order as a sale IS here now, as recordSale below —
 * and it is the one action in this file that moves stock, by calling
 * convert_storefront_order_to_sale, which calls post_sale. Everything else
 * still only changes a status.
 *
 * Otherwise deliberately NOT here: anything that moves stock. That is post_sale()'s job
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

  /*
   * Read the current status first, so setting the one it already has does
   * nothing at all.
   *
   * HQ-01006's audit trail carries "cancelled" TEN TIMES inside seven
   * seconds, plus a "confirmed" and a "placed". Whatever the owner was doing,
   * the record of it is now unreadable — and the trail is the only answer
   * there will ever be to a customer asking when their order was cancelled.
   */
  const { data: current, error: readError } = await supabase
    .from("storefront_orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (readError || !current) return;
  if (current.status === status) {
    /* Already there. Not an error — the button simply had nothing to do. */
    revalidatePath(`/orders/${id}`);
    return;
  }

  /*
   * The error was DISCARDED here. If the update failed — a policy, a
   * constraint, a dropped connection — the event below was still written, so
   * the audit trail recorded a change that never happened and the screen
   * showed the old status with nothing to explain it. A log that can be wrong
   * about the thing it exists to record is worse than no log.
   */
  const { error: writeError } = await supabase
    .from("storefront_orders")
    .update({ status })
    .eq("id", id);

  if (writeError) {
    revalidatePath(`/orders/${id}`);
    return;
  }

  /* The audit trail is the only record of who changed what, and the customer
     may ask. Same table the courier webhooks write to. Written only after the
     status actually moved. */
  await supabase.from("storefront_order_events").insert({
    order_id: id,
    kind: "status_changed",
    detail: { to: status, from: current.status, source: "erp" },
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
/**
 * Record a delivered website order as an ERP sale.
 *
 * The step that makes the profit reports true. Until this exists, revenue,
 * COGS, margin and stock all exclude every online order, and the owner has to
 * re-key each delivered parcel on the Sales screen from memory.
 *
 * A button rather than something that fires automatically when the status
 * becomes `delivered`, because "delivered" is a button a tired person taps on
 * a phone and a stock movement is not something to write by accident. The
 * database enforces the rest: convert_storefront_order_to_sale refuses an
 * order that is not delivered, refuses a caller who is not an admin, and — via
 * a unique constraint on sales.storefront_order_id — refuses to do it twice,
 * so a double tap on a slow connection cannot double-count revenue.
 *
 * The error is surfaced rather than swallowed. Every other action here fails
 * silently on purpose (a status that did not change is visible on the next
 * render), but this one moves money and stock: if it did not happen, the owner
 * has to know, or they will believe their reports.
 */
export async function recordSale(formData: FormData): Promise<void> {
  await guard();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("convert_storefront_order_to_sale", {
    p_order_id: id,
  });

  if (error) {
    /* The RPC's messages are written for this reader — "is placed, not
       delivered", "is already recorded as a sale" — so they are shown as-is
       rather than replaced with something vaguer. */
    redirect(`/orders/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath("/sales");
  revalidatePath("/stock");
}

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
