"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function adjustStock(_prev: string | null, fd: FormData) {
  const productId = String(fd.get("product_id") ?? "");
  if (!productId) return "Choose a product.";

  const direction = String(fd.get("direction") ?? "out");
  const qty = Math.trunc(Number(fd.get("qty") ?? 0));
  if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be at least 1.";

  const reason = String(fd.get("reason") ?? "count");
  const note = String(fd.get("note") ?? "").trim() || null;
  const supabase = await createClient();

  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_qty_delta: direction === "in" ? qty : -qty,
    p_unit_cost: null,
    p_note: note ?? (reason === "damage" ? "damaged" : "stock count correction"),
    p_damage: reason === "damage",
  });

  if (error) return error.message;

  revalidatePath("/stock");
  revalidatePath("/products");
  revalidatePath("/");
  return null;
}
