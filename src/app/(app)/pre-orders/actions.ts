"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalisePhone } from "@/lib/phone";
import type { PreOrderStatus } from "@/lib/types";

export type PreOrderInput = {
  customer_name: string;
  customer_phone: string;
  product_id: string | null;
  item_note: string | null;
  qty: number;
  total_amount: number;
  amount_paid: number;
  order_date: string;
  expected_date: string | null;
  status: PreOrderStatus;
  note: string | null;
};

/** Shared by create and update so the two can never drift apart. */
function validate(input: PreOrderInput): { error: string } | { value: PreOrderInput } {
  const name = input.customer_name.trim();
  if (!name) return { error: "Customer name is required." };

  const phone = normalisePhone(input.customer_phone ?? "");
  if (!phone) {
    return {
      error: "Enter a valid mobile number — 11 digits starting 01, e.g. 01712345678.",
    };
  }

  if (!input.product_id && !(input.item_note ?? "").trim()) {
    return { error: "Choose a product, or describe the item if it is not in the catalogue." };
  }

  if (!Number.isFinite(input.qty) || input.qty < 1) {
    return { error: "Quantity must be at least 1." };
  }
  if (!Number.isFinite(input.total_amount) || input.total_amount < 0) {
    return { error: "Total amount cannot be negative." };
  }
  if (!Number.isFinite(input.amount_paid) || input.amount_paid < 0) {
    return { error: "Amount paid cannot be negative." };
  }
  if (input.amount_paid > input.total_amount) {
    return { error: "Amount paid is more than the total. Raise the total, or lower what was paid." };
  }
  if (input.expected_date && input.expected_date < input.order_date) {
    return { error: "Expected delivery cannot be before the order date." };
  }

  return {
    value: {
      ...input,
      customer_name: name,
      customer_phone: phone,
      item_note: (input.item_note ?? "").trim() || null,
      note: (input.note ?? "").trim() || null,
      qty: Math.trunc(input.qty),
      expected_date: input.expected_date || null,
    },
  };
}

export async function createPreOrder(input: PreOrderInput): Promise<string | null> {
  const checked = validate(input);
  if ("error" in checked) return checked.error;

  const supabase = await createClient();
  const { error } = await supabase.from("pre_orders").insert(checked.value);
  if (error) return error.message;

  revalidatePath("/pre-orders");
  revalidatePath("/");
  return null;
}

export async function updatePreOrder(
  id: string,
  input: PreOrderInput,
): Promise<string | null> {
  const checked = validate(input);
  if ("error" in checked) return checked.error;

  const supabase = await createClient();
  const { error } = await supabase.from("pre_orders").update(checked.value).eq("id", id);
  if (error) return error.message;

  revalidatePath("/pre-orders");
  revalidatePath(`/pre-orders/${id}`);
  revalidatePath("/");
  return null;
}

/** Quick action from the list: settle the balance without opening the form. */
export async function markPreOrderPaid(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const supabase = await createClient();

  const { data } = await supabase
    .from("pre_orders")
    .select("total_amount")
    .eq("id", id)
    .maybeSingle();

  if (!data) return;

  await supabase.from("pre_orders").update({ amount_paid: data.total_amount }).eq("id", id);

  revalidatePath("/pre-orders");
  revalidatePath("/");
}

/** Record a part payment. Clamped to the total, which the DB also enforces. */
export async function recordPayment(
  id: string,
  amount: number,
): Promise<string | null> {
  if (!Number.isFinite(amount) || amount < 0) return "Amount cannot be negative.";

  const supabase = await createClient();
  const { data } = await supabase
    .from("pre_orders")
    .select("total_amount")
    .eq("id", id)
    .maybeSingle();

  if (!data) return "Pre-order not found.";

  const capped = Math.min(amount, Number(data.total_amount));
  const { error } = await supabase
    .from("pre_orders")
    .update({ amount_paid: capped })
    .eq("id", id);

  if (error) return error.message;

  revalidatePath("/pre-orders");
  revalidatePath(`/pre-orders/${id}`);
  return null;
}

export async function setPreOrderStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as PreOrderStatus;

  const supabase = await createClient();
  await supabase.from("pre_orders").update({ status }).eq("id", id);

  revalidatePath("/pre-orders");
  revalidatePath("/");
}

export async function deletePreOrder(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("pre_orders").delete().eq("id", id);

  revalidatePath("/pre-orders");
  revalidatePath("/");
}
