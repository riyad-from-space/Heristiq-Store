"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalisePhone } from "@/lib/phone";
import type { PreOrderStatus } from "@/lib/types";

export type PreOrderLine = {
  product_id: string | null;
  item_note: string | null;
  qty: number;
  unit_price: number;
};

export type PreOrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  amount_paid: number;
  order_date: string;
  expected_date: string | null;
  status: PreOrderStatus;
  note: string | null;
  lines: PreOrderLine[];
};

/** Every path that writes a pre-order goes through here, so rules cannot drift. */
function validate(input: PreOrderPayload): { error: string } | { value: PreOrderPayload } {
  const name = input.customer_name.trim();
  if (!name) return { error: "Customer name is required." };

  const phone = normalisePhone(input.customer_phone ?? "");
  if (!phone) {
    return { error: "Enter a valid mobile number — 11 digits starting 01, e.g. 01712345678." };
  }

  const lines = input.lines.filter((l) => l.product_id || (l.item_note ?? "").trim());
  if (lines.length === 0) {
    return { error: "Add at least one item." };
  }

  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty < 1) {
      return { error: "Every item needs a quantity of at least 1." };
    }
    if (!Number.isFinite(l.unit_price) || l.unit_price < 0) {
      return { error: "Item prices cannot be negative." };
    }
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  if (!Number.isFinite(input.amount_paid) || input.amount_paid < 0) {
    return { error: "Advance paid cannot be negative." };
  }
  if (input.amount_paid > total) {
    return {
      error: "The advance is more than the order total. Raise a price, or lower what was paid.",
    };
  }
  if (input.expected_date && input.expected_date < input.order_date) {
    return { error: "Expected delivery cannot be before the order date." };
  }

  return {
    value: {
      ...input,
      customer_name: name,
      customer_phone: phone,
      customer_address: (input.customer_address ?? "").trim() || null,
      note: (input.note ?? "").trim() || null,
      lines: lines.map((l) => ({
        product_id: l.product_id || null,
        item_note: l.product_id ? null : (l.item_note ?? "").trim() || null,
        qty: Math.trunc(l.qty),
        unit_price: l.unit_price,
      })),
    },
  };
}

/** Create when id is null, otherwise replace. One RPC, so it cannot half-apply. */
export async function savePreOrder(
  id: string | null,
  input: PreOrderPayload,
): Promise<string | null> {
  const checked = validate(input);
  if ("error" in checked) return checked.error;
  const v = checked.value;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_pre_order", {
    p_id: id,
    p_customer_name: v.customer_name,
    p_customer_phone: v.customer_phone,
    p_customer_address: v.customer_address,
    p_amount_paid: v.amount_paid,
    p_order_date: v.order_date,
    p_expected_date: v.expected_date,
    p_status: v.status,
    p_note: v.note,
    p_lines: v.lines,
  });

  if (error) return error.message;

  revalidatePath("/pre-orders");
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/");
  return null;
}

export async function deletePreOrder(formData: FormData): Promise<string | null> {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("pre_orders").delete().eq("id", id);

  if (error) return error.message;

  revalidatePath("/pre-orders");
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/");
  return null;
}

/**
 * Delivery: the pre-order becomes a real sale, once.
 *
 * Everything before this was a promise — the goods were reserved but never left
 * the shelf, and no revenue existed. This is the moment goods move, so this is
 * where the sale and the ledger entry are written.
 */
export async function deliverPreOrder(
  id: string,
  deliveryCharge = 0,
  deliveryCost = 0,
): Promise<{ error: string } | { saleId: string }> {
  if (deliveryCharge < 0 || deliveryCost < 0) {
    return { error: "Delivery amounts cannot be negative." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deliver_pre_order", {
    p_pre_order_id: id,
    p_delivery_charge: deliveryCharge,
    p_delivery_cost: deliveryCost,
  });

  if (error) return { error: error.message };

  revalidatePath("/pre-orders");
  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/reports");
  revalidatePath("/");
  return { saleId: String(data) };
}
