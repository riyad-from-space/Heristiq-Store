import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { erpEnv } from "@/lib/env";

/*
 * The ERP database, reached with the service-role key.
 *
 * Why service-role and not the anon key: the ERP's RLS grants access to
 * `authenticated` only, and its migration 0011 deliberately revoked EXECUTE
 * from `anon` across the whole schema. A storefront visitor is neither. So the
 * storefront reads as the service role, entirely server-side, and ships NO
 * Supabase client to the browser — there is no browser client in this codebase
 * at all, and lib/env is `server-only` so adding one is a compile error.
 *
 * The trade for that power is that every query here must select columns
 * explicitly. `select("*")` on v_product_stock would pull avg_cost, unit_margin
 * and stock_value into a page's props and straight out to the customer.
 */

let cached: SupabaseClient | null = null;

export function erpDb(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(erpEnv.url, erpEnv.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "heristiq-store" } },
  });
  return cached;
}
