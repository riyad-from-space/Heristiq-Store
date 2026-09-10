"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminState } from "@/lib/admin";

/*
 * Managing admin access.
 *
 * `claimAdmin` used to live here — a one-click way to end bootstrap mode by
 * writing yourself into erp_admins. It is gone, and it had to be: migration
 * 1007 made is_erp_admin() fail closed, and erp_admins is itself gated by
 * that function, so on an empty table the insert is refused. A button that
 * cannot work is worse than no button.
 *
 * The first administrator is now created with one INSERT from the Supabase
 * SQL editor, which the no-access screen prints for you. Every administrator
 * after that is added here, by an existing one — which is the point at which
 * a one-click control is safe, because somebody authorised is doing the
 * clicking.
 */
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
