"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminState } from "@/lib/admin";

/*
 * Claiming and managing admin access.
 *
 * `claimAdmin` is the one-click end to bootstrap mode: it writes the signed-in
 * user into erp_admins, after which is_erp_admin() is strict and nobody else
 * gets in. It exists so that locking the ERP down does not require the owner
 * to open a SQL console — which, realistically, would mean it never happened.
 *
 * The race it has to survive: two people claiming at once. The insert is a
 * plain insert against a primary key, so the second is a duplicate rather than
 * a second admin, and the check below refuses anyone who is not already
 * entitled once the table is non-empty.
 */
export async function claimAdmin(): Promise<string | null> {
  const admin = await adminState();
  if (!admin) return "You are not signed in.";

  /*
   * Only legal while nobody has claimed it. After that this is an ordinary
   * privileged action and the caller must already be an admin — otherwise the
   * bootstrap would be a permanent back door.
   */
  if (!admin.bootstrap && !admin.isAdmin) {
    return "Only an existing administrator can add another.";
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("erp_admins")
    .insert({ email: admin.email, note: "Claimed from the ERP" });

  if (error) {
    if (error.code === "23505") return null; // already an admin; nothing to do
    return `Could not save that: ${error.message}`;
  }

  revalidatePath("/", "layout");
  return null;
}

export async function addAdmin(formData: FormData): Promise<void> {
  const admin = await adminState();
  if (!admin?.isAdmin) return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return;

  const supabase = await createClient();
  await supabase.from("erp_admins").insert({ email });
  revalidatePath("/settings");
}

export async function removeAdmin(formData: FormData): Promise<void> {
  const admin = await adminState();
  if (!admin?.isAdmin) return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  /*
   * Never remove the last one. An ERP with no administrators is an ERP nobody
   * can get into — and unlike the bootstrap case there would be no empty-table
   * fallback to rescue it, because the row would have to be deleted from SQL.
   */
  if (admin.adminCount <= 1) return;

  const supabase = await createClient();
  await supabase.from("erp_admins").delete().eq("email", email);
  revalidatePath("/settings");
}
