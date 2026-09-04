"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PurchaseLine = { product_id: string; qty: number; unit_cost: number };

export type PurchaseInput = {
  supplier_id: string | null;
  purchase_date: string;
  freight_cost: number;
  import_cost: number;
  other_cost: number;
  note: string | null;
  lines: PurchaseLine[];
};

export async function createPurchase(input: PurchaseInput): Promise<string | null> {
  const lines = input.lines.filter(
    (l) => l.product_id && l.qty > 0 && l.unit_cost >= 0,
  );
  if (lines.length === 0) return "Add at least one product line.";

  // A line with a product and a quantity but no cost used to post at zero,
  // permanently pulling that product's weighted average down. Free stock is
  // real, but it has to be stated rather than left blank.
  const priced = input.lines.filter((l) => l.product_id && l.qty > 0);
  const blank = priced.find((l) => !Number.isFinite(l.unit_cost) || l.unit_cost <= 0);
  if (blank && priced.some((l) => l.unit_cost > 0)) {
    return "One line has no unit cost. Enter what you paid, or 0 if it really was free.";
  }

  // Duplicate products are allowed here on purpose — two cartons of one SKU at
  // two prices is ordinary procurement, and post_purchase blends them correctly.
  // (Sales are different: update_sale reconciles per product, so duplicates are
  // rejected there and blocked by a unique constraint.)

  if (lines.reduce((s, l) => s + l.qty * l.unit_cost, 0) <= 0) {
    return "Total purchase value must be greater than zero.";
  }

  const supabase = await createClient();

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      supplier_id: input.supplier_id,
      purchase_date: input.purchase_date,
      freight_cost: input.freight_cost,
      import_cost: input.import_cost,
      other_cost: input.other_cost,
      note: input.note,
    })
    .select("id")
    .single();

  if (purchaseError || !purchase) return purchaseError?.message ?? "Could not save.";

  const { error: itemsError } = await supabase
    .from("purchase_items")
    .insert(lines.map((l) => ({ ...l, purchase_id: purchase.id })));

  if (itemsError) {
    // Nothing has hit the stock ledger yet, so removing the header is a clean rollback.
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return itemsError.message;
  }

  const { error: postError } = await supabase.rpc("post_purchase", {
    p_purchase_id: purchase.id,
  });

  if (postError) {
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return postError.message;
  }

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/purchases");
}
