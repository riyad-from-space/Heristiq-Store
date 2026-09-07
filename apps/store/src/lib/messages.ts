import "server-only";
import { z } from "zod";
import { erpEnv } from "@/lib/env";
import { erpDb } from "@/lib/erp/supabase";
import { normalisePhone } from "@/lib/phone";

/*
 * Contact messages and newsletter sign-ups.
 *
 * Both existed as forms that validated their input and then threw it away —
 * the newsletter said "noted" and stored nothing, and there was no contact
 * page at all. A form that discards what someone typed is worse than no form:
 * they believe they will hear back, and they will not.
 *
 * With no credentials configured these log to the server and report `stored:
 * false`, and the UI says so rather than claiming success.
 */

export const messageSchema = z.object({
  name: z.string().trim().min(2, "Please tell us your name.").max(80),
  email: z
    .string()
    .trim()
    .max(160)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v), {
      message: "That email does not look right.",
    }),
  phone: z
    .string()
    .trim()
    .max(24)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  subject: z.string().trim().max(120).nullable().default(null),
  orderReference: z.string().trim().max(32).nullable().default(null),
  message: z
    .string()
    .trim()
    .min(10, "A sentence or two, so we can actually help.")
    .max(2000),
});

export type MessageInput = z.input<typeof messageSchema>;

export type SaveResult =
  | { ok: true; stored: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function saveMessage(input: MessageInput): Promise<SaveResult> {
  const parsed = messageSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { ok: false, error: "Some details need fixing.", fieldErrors };
  }

  const value = parsed.data;

  /* One of the two, or we cannot reply — the database enforces this too. */
  if (!value.email && !value.phone) {
    return {
      ok: false,
      error: "We need either an email or a phone number to reply to.",
      fieldErrors: { phone: "Add a phone number or an email." },
    };
  }

  const phone = value.phone ? (normalisePhone(value.phone) ?? value.phone) : null;

  if (!erpEnv.configured || erpEnv.forceMock) {
    console.info(
      `[contact] message from ${value.name} (${value.email ?? phone}) — NOT stored, no ERP credentials:\n${value.message}`,
    );
    return { ok: true, stored: false };
  }

  const { error } = await erpDb().from("storefront_messages").insert({
    name: value.name,
    email: value.email,
    phone,
    subject: value.subject,
    order_reference: value.orderReference,
    message: value.message,
  });

  if (error) throw new Error(`Message write failed: ${error.message}`);
  return { ok: true, stored: true };
}

export type SubscribeResult =
  | { ok: true; stored: boolean; alreadySubscribed: boolean }
  | { ok: false; error: string };

export async function subscribe(
  rawEmail: string,
  source = "footer",
): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) || email.length > 160) {
    return { ok: false, error: "That email does not look right." };
  }

  if (!erpEnv.configured || erpEnv.forceMock) {
    console.info(`[newsletter] ${email} — NOT stored, no ERP credentials`);
    return { ok: true, stored: false, alreadySubscribed: false };
  }

  /*
   * Upsert, and treat an existing row as success. Telling someone "you are
   * already subscribed" is information about who is on the list, and the only
   * thing it changes for them is nothing.
   */
  const { error } = await erpDb()
    .from("storefront_subscribers")
    .upsert({ email, source, unsubscribed_at: null }, { onConflict: "email" });

  if (error) throw new Error(`Subscribe failed: ${error.message}`);
  return { ok: true, stored: true, alreadySubscribed: false };
}
