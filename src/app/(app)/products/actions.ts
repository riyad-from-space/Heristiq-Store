"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function money(fd: FormData, key: string) {
  const n = Number(fd.get(key) ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * An emptied number input posts "", and Number("") is 0 — so `?? fallback` never
 * fires and clearing the field silently saved 0. Treat blank as absent.
 */
function count(fd: FormData, key: string, fallback: number) {
  const raw = String(fd.get(key) ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

export async function createProduct(_prev: string | null, fd: FormData) {
  const supabase = await createClient();

  const sku = text(fd, "sku");
  const name = text(fd, "name");
  if (!sku || !name) return "SKU and name are required.";

  const { error } = await supabase.from("products").insert({
    sku,
    name,
    category_id: text(fd, "category_id"),
    supplier_id: text(fd, "supplier_id"),
    selling_price: money(fd, "selling_price"),
    reorder_level: count(fd, "reorder_level", 3),
  });

  if (error) {
    return error.code === "23505"
      ? `SKU "${sku}" already exists.`
      : error.message;
  }

  revalidatePath("/products");
  return null;
}

export async function updateProduct(_prev: string | null, fd: FormData) {
  const supabase = await createClient();
  const id = String(fd.get("id"));

  // Same guard as createProduct — HTML `required` accepts a single space, which
  // trims to null and would surface a raw not-null constraint message.
  const sku = text(fd, "sku");
  const name = text(fd, "name");
  if (!sku || !name) return "SKU and name are required.";

  const { error } = await supabase
    .from("products")
    .update({
      sku,
      name,
      category_id: text(fd, "category_id"),
      supplier_id: text(fd, "supplier_id"),
      selling_price: money(fd, "selling_price"),
      reorder_level: count(fd, "reorder_level", 3),
      is_active: fd.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) return error.message;

  // Unit cost is derived from purchases, so a manual change is recorded as a
  // correction rather than written straight to the stock cache.
  //
  // Only act when the value actually MOVED. Comparing against the value the form
  // was rendered with distinguishes "left alone" from "deliberately set to the
  // same number", so an ordinary rename no longer files a cost correction — and
  // a stale or failed read cannot silently revalue the product to zero.
  const rawCost = fd.get("avg_cost");
  const rawOriginal = fd.get("avg_cost_original");

  if (rawCost !== null && String(rawCost).trim() !== "" && rawOriginal !== null) {
    const cost = Number(rawCost);
    const original = Number(rawOriginal);

    if (!Number.isFinite(cost) || cost < 0) return "Cost must be zero or more.";

    // numeric(14,4) in the database, so compare at that precision.
    const changed = Math.abs(cost - original) >= 0.00005;

    if (changed) {
      const { error: costError } = await supabase.rpc("revalue_product_cost", {
        p_product_id: id,
        p_new_cost: cost,
        p_note: "Edited on the product page",
      });

      if (costError) return costError.message;
    }
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/stock");
  revalidatePath("/reports");
  revalidatePath("/");
  redirect("/products");
}

export async function createCategory(_prev: string | null, fd: FormData) {
  const supabase = await createClient();
  const name = text(fd, "name");
  if (!name) return "Name is required.";

  const { error } = await supabase.from("categories").insert({ name });
  if (error) {
    return error.code === "23505" ? `"${name}" already exists.` : error.message;
  }

  revalidatePath("/products");
  return null;
}
