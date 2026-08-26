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
    reorder_level: Math.max(0, Math.trunc(Number(fd.get("reorder_level") ?? 3))),
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

  const { error } = await supabase
    .from("products")
    .update({
      sku: text(fd, "sku"),
      name: text(fd, "name"),
      category_id: text(fd, "category_id"),
      supplier_id: text(fd, "supplier_id"),
      selling_price: money(fd, "selling_price"),
      reorder_level: Math.max(0, Math.trunc(Number(fd.get("reorder_level") ?? 3))),
      is_active: fd.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) return error.message;

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
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
