"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSupplier(_prev: string | null, fd: FormData) {
  const supabase = await createClient();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return "Name is required.";

  const { error } = await supabase.from("suppliers").insert({
    name,
    phone: String(fd.get("phone") ?? "").trim() || null,
    address: String(fd.get("address") ?? "").trim() || null,
    note: String(fd.get("note") ?? "").trim() || null,
  });

  if (error) {
    return error.code === "23505" ? `"${name}" already exists.` : error.message;
  }

  revalidatePath("/suppliers");
  return null;
}
