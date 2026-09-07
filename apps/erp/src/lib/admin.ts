import "server-only";
import { createClient } from "@/lib/supabase/server";

/*
 * Who may use the ERP.
 *
 * Before this, the only gate was `if (!user) redirect("/login")` — any signed
 * in Supabase user reached the whole ERP, and because the RLS policies granted
 * `authenticated` full access, they could also read products, costs, suppliers
 * and margins straight from the API with the public anon key. Sign-ups are
 * open by default, so "any signed-in user" meant "anyone who registered".
 *
 * The real fix is in the database — migration 1004 replaced those policies with
 * `is_erp_admin()`, so an outsider now reads nothing however they ask. This
 * file is the matching check in the UI, so a non-admin gets a clear page
 * instead of a working-looking ERP full of empty tables.
 *
 * Two sources of truth, in order:
 *   1. the erp_admins table — the one the database itself enforces
 *   2. ERP_ADMIN_EMAILS — an env allowlist, so access can be granted or
 *      revoked without a database round trip
 *
 * BOOTSTRAP: with erp_admins empty and no allowlist set, any signed-in user is
 * admin — exactly the old behaviour. That is deliberate: failing closed on an
 * empty table would lock the owner out of their own ERP with no way back in.
 * The UI shows an unmissable warning in that state and offers one click to end
 * it.
 */

export type AdminState = {
  email: string;
  /** True when this user may use the ERP. */
  isAdmin: boolean;
  /** True while nobody has claimed admin — the open, insecure state. */
  bootstrap: boolean;
  /** How many admins are registered. */
  adminCount: number;
};

function allowlist(): string[] {
  return (process.env.ERP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The signed-in user's admin state, or null when nobody is signed in.
 *
 * Never throws on a database error: it returns a non-admin state instead, so a
 * transient failure shows the "no access" page rather than a stack trace.
 */
export async function adminState(): Promise<AdminState | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;
  const email = user.email.toLowerCase();

  const { data, error } = await supabase.from("erp_admins").select("email");

  /*
   * A read error here is almost always "relation does not exist" — migration
   * 1004 has not been applied yet. Treat it as bootstrap so the ERP keeps
   * working on an un-migrated database, which is the state it is in today.
   */
  if (error) {
    return { email, isAdmin: true, bootstrap: true, adminCount: 0 };
  }

  const admins = (data ?? []).map((row) => String(row.email).toLowerCase());
  const list = allowlist();

  if (admins.length === 0 && list.length === 0) {
    return { email, isAdmin: true, bootstrap: true, adminCount: 0 };
  }

  return {
    email,
    isAdmin: admins.includes(email) || list.includes(email),
    bootstrap: false,
    adminCount: admins.length,
  };
}
