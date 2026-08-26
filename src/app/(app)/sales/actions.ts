"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SaleStatus, SalesChannel } from "@/lib/types";

export type SaleLine = { product_id: string; qty: number; unit_price: number };

export type SaleInput = {
  sale_date: string;
  channel: SalesChannel;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  discount: number;
  delivery_charge: number;
  delivery_cost: number;
  status: SaleStatus;
  note: string | null;
  lines: SaleLine[];
};

export async function createSale(input: SaleInput): Promise<string | null> {
  const lines = input.lines.filter((l) => l.product_id && l.qty > 0);
  if (lines.length === 0) return "Add at least one product line.";

  const supabase = await createClient();

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      sale_date: input.sale_date,
      channel: input.channel,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      customer_address: input.customer_address,
      discount: input.discount,
      delivery_charge: input.delivery_charge,
      delivery_cost: input.delivery_cost,
      status: input.status,
      note: input.note,
    })
    .select("id")
    .single();

  if (saleError || !sale) return saleError?.message ?? "Could not save.";

  const { error: itemsError } = await supabase
    .from("sale_items")
    .insert(lines.map((l) => ({ ...l, sale_id: sale.id })));

  if (itemsError) {
    await supabase.from("sales").delete().eq("id", sale.id);
    return itemsError.message;
  }

  // Snapshots cost and writes the stock ledger.
  const { error: postError } = await supabase.rpc("post_sale", { p_sale_id: sale.id });

  if (postError) {
    await supabase.from("sales").delete().eq("id", sale.id);
    return postError.message;
  }

  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/sales");
}

export async function updateSale(
  id: string,
  input: SaleInput,
): Promise<string | null> {
  const lines = input.lines.filter((l) => l.product_id && l.qty > 0);
  if (lines.length === 0) return "Add at least one product line.";

  const supabase = await createClient();

  // One call: the function updates the header and reconciles each line against
  // the ledger, so a part-applied edit cannot leave stock wrong.
  const { error } = await supabase.rpc("update_sale", {
    p_sale_id: id,
    p_sale_date: input.sale_date,
    p_channel: input.channel,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_customer_address: input.customer_address,
    p_discount: input.discount,
    p_delivery_charge: input.delivery_charge,
    p_delivery_cost: input.delivery_cost,
    p_status: input.status,
    p_note: input.note,
    p_lines: lines,
  });

  if (error) return error.message;

  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/reports");
  revalidatePath("/");
  redirect("/sales");
}

export async function voidSale(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("void_sale", {
    p_sale_id: String(formData.get("id")),
    p_status: String(formData.get("status") ?? "cancelled"),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/sales");
  revalidatePath("/products");
  revalidatePath("/");
}
