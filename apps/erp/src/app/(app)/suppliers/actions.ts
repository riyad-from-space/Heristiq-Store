"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export async function createSupplier(_prev: string | null, fd: FormData) {
  /* A Server Action is a public POST endpoint; the page gate does not
     protect it. See requireAdmin(). */
  await requireAdmin();

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
