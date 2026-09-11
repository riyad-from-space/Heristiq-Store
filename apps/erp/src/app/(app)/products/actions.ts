"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

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
  /* A Server Action is a public POST endpoint; the page gate does not
     protect it. See requireAdmin(). */
  await requireAdmin();

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
  /* A Server Action is a public POST endpoint; the page gate does not
     protect it. See requireAdmin(). */
  await requireAdmin();

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

/*
 * Categories are the STOREFRONT's browse structure, not just an inventory
 * label — each one is a page at /shop/<slug> with a heading and a line of
 * copy under it. So the fields the shop renders are editable here, or the
 * owner would need SQL to reorder a menu.
 *
 * The slug is deliberately NOT one of them. It is derived from the name by a
 * trigger (migration 1008), because a hand-edited slug is a broken link the
 * day someone changes it, and nothing in this admin would warn them.
 */
export async function createCategory(_prev: string | null, fd: FormData) {
  /* A Server Action is a public POST endpoint; the page gate does not
     protect it. See requireAdmin(). */
  await requireAdmin();

  const supabase = await createClient();
  const name = text(fd, "name");
  if (!name) return "Name is required.";

  const { error } = await supabase.from("categories").insert({
    name,
    blurb: text(fd, "blurb"),
    /* Default 100, so a category added without a position sorts after the
       five that have one rather than jumping to the front of the menu. */
    position: count(fd, "position", 100),
  });
  if (error) return categoryError(error, name);

  revalidatePath("/products");
  return null;
}

export async function updateCategory(_prev: string | null, fd: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const id = String(fd.get("id"));
  const name = text(fd, "name");
  if (!id) return "Missing category.";
  if (!name) return "Name is required.";

  const { error } = await supabase
    .from("categories")
    .update({
      name,
      blurb: text(fd, "blurb"),
      position: count(fd, "position", 100),
      /* Unchecked hides the category from the shop. Products keep their
         category, so ticking it back restores the page exactly. */
      is_active: fd.get("is_active") === "on",
    })
    .eq("id", id);
  if (error) return categoryError(error, name);

  revalidatePath("/products");
  return null;
}

/*
 * Both database guards from 1008 surface as errors here, and both need
 * translating — a raw Postgres message is not something the owner can act on.
 */
function categoryError(
  error: { code?: string; message: string },
  name: string,
) {
  if (error.code === "23505") {
    /* unique(org_id, name) or unique(org_id, slug). The slug case is the
       confusing one: "Finger Rings" and "Finger rings" are different names
       that produce the same URL. */
    return `"${name}" clashes with an existing category — check for one with the same name or that would make the same web address.`;
  }
  if (error.code === "23514") {
    /* categories_slug_not_reserved */
    return `"${name}" would take a web address the shop already uses (cart, checkout, about and so on). Pick another name.`;
  }
  return error.message;
}
