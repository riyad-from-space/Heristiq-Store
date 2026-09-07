"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminState } from "@/lib/admin";

/*
 * Storefront settings the owner changes without a deploy.
 *
 * These were environment variables, which meant a redeploy to change a
 * delivery fee — so in practice they never changed. The storefront reads the
 * same rows (apps/store/src/lib/settings.ts) with the env values as a
 * fallback, so an un-migrated database behaves exactly as before.
 */
async function guard() {
  const admin = await adminState();
  if (!admin?.isAdmin) throw new Error("Not authorised.");
}

function num(form: FormData, key: string, fallback: number) {
  const value = Number(form.get(key));
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

export async function saveDelivery(formData: FormData): Promise<void> {
  await guard();
  const supabase = await createClient();

  await supabase.from("storefront_settings").upsert(
    {
      key: "delivery",
      value: {
        inside_dhaka_fee: num(formData, "inside_dhaka_fee", 70),
        outside_dhaka_fee: num(formData, "outside_dhaka_fee", 130),
        /* 0 disables free delivery entirely, which is a real choice and not
           the same as "no threshold set". */
        free_threshold: num(formData, "free_threshold", 0),
        inside_days_min: num(formData, "inside_days_min", 1),
        inside_days_max: num(formData, "inside_days_max", 2),
        outside_days_min: num(formData, "outside_days_min", 2),
        outside_days_max: num(formData, "outside_days_max", 4),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  revalidatePath("/settings");
}

export async function savePromo(formData: FormData): Promise<void> {
  await guard();
  const supabase = await createClient();

  await supabase.from("storefront_settings").upsert(
    {
      key: "promo",
      value: {
        enabled: formData.get("enabled") === "on",
        message: String(formData.get("message") ?? "").trim().slice(0, 160),
        href: String(formData.get("href") ?? "").trim().slice(0, 200),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  revalidatePath("/settings");
}

export async function savePayment(formData: FormData): Promise<void> {
  await guard();
  const supabase = await createClient();

  await supabase.from("storefront_settings").upsert(
    {
      key: "payment",
      value: {
        cod_deposit_enabled: formData.get("cod_deposit_enabled") === "on",
        cod_deposit_amount: num(formData, "cod_deposit_amount", 100),
        bkash_number: String(formData.get("bkash_number") ?? "").trim(),
        nagad_number: String(formData.get("nagad_number") ?? "").trim(),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  revalidatePath("/settings");
}
