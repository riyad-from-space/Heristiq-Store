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
   * A read error is almost always "relation does not exist" — the migrations
   * have not been applied.
   *
   * This used to return isAdmin: true so the ERP kept working on an
   * un-migrated database. That is exactly backwards for a security boundary:
   * the one state where the database cannot vouch for anybody is not the
   * state in which to trust everybody. It now fails closed, and the screen
   * tells the owner to apply the migrations.
   */
  if (error) {
    return { email, isAdmin: false, bootstrap: true, adminCount: 0 };
  }

  const admins = (data ?? []).map((row) => String(row.email).toLowerCase());
  const list = allowlist();

  /*
   * An empty table no longer means "everyone is an admin".
   *
   * Migration 1007 removed that bootstrap from is_erp_admin() after the
   * security audit showed what it actually granted: while erp_admins was
   * empty, any stranger who registered a Supabase account could read costs,
   * margins and suppliers, and rename a product — which lands as stored XSS
   * on the public shop. Proven, then closed. See supabase/tests/bootstrap-window.sql.
   *
   * `bootstrap` now means only "nobody has been made an admin yet", which the
   * no-access screen uses to show the one INSERT that fixes it. It no longer
   * grants anything.
   *
   * ERP_ADMIN_EMAILS still works as an app-layer allowlist, but it cannot
   * grant database access on its own — Postgres cannot read the app's
   * environment, so a listed address must also be in erp_admins.
   */
  if (admins.length === 0) {
    return {
      email,
      isAdmin: false,
      bootstrap: true,
      adminCount: 0,
    };
  }

  return {
    email,
    isAdmin: admins.includes(email) || list.includes(email),
    bootstrap: false,
    adminCount: admins.length,
  };
}

/**
 * Throw unless the caller is a listed ERP admin.
 *
 * Call this FIRST in every Server Action that touches data.
 *
 * The reason it has to exist at all: a Server Action is a public POST
 * endpoint. The gate in app/(app)/layout.tsx protects the PAGE — it runs when
 * a page renders — and an attacker never renders the page. They post straight
 * to the action's endpoint, which Next exposes whether or not any UI led
 * there.
 *
 * The database is the real boundary and it holds: `authenticated` has zero
 * table privileges on the ledger, RLS is admin-only, and every write RPC calls
 * require_erp_admin(). So an unguarded action fails at the database rather
 * than succeeding. But it fails as an opaque Postgres error rather than a
 * refusal, and — critically — while erp_admins is EMPTY, is_erp_admin()
 * bootstraps to true for everyone, so the database is NOT a boundary during
 * that window. This is what closes it in the app layer too.
 */
export async function requireAdmin(): Promise<AdminState> {
  const admin = await adminState();
  if (!admin?.isAdmin) {
    throw new Error("Not authorised.");
  }
  return admin;
}
