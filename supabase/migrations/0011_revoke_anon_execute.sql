-- SECURITY: 0005 did not actually close the hole. This does.
--
-- 0005 revoked EXECUTE from PUBLIC, which is the right move on stock Postgres.
-- But Supabase runs, at project setup:
--
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role;
--
-- so every function created afterwards carries an EXPLICIT grant to `anon`, and
-- revoking the PUBLIC default leaves that untouched. Confirmed on the live
-- project after 0005 had been applied: calling adjust_stock with only the public
-- anon key still entered the function body and failed on a foreign key, not on
-- permission. The ACL read:
--
--   postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
--
-- Because these are SECURITY DEFINER they run as the owner and bypass RLS, and
-- the anon key ships in the browser bundle. So this was still live.
--
-- Revoke from the whole schema rather than function-by-function, so nothing
-- added later reopens it, then re-grant only what the app needs.

revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

-- Stop FUTURE functions being callable in the first place. Both halves matter:
-- Supabase adds the anon grant, and Postgres itself grants EXECUTE to PUBLIC on
-- every new function. Revoking only the first leaves the second, so a function
-- added in a later migration would silently be reachable again — which is
-- exactly what happened to deliver_pre_order in 0012.
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from public;

-- The app calls these as a signed-in user.
grant execute on function post_purchase(uuid)                              to authenticated;
grant execute on function post_sale(uuid)                                  to authenticated;
grant execute on function void_sale(uuid, sale_status)                     to authenticated;
grant execute on function adjust_stock(uuid, int, numeric, text, boolean)  to authenticated;
grant execute on function revalue_product_cost(uuid, numeric, text)        to authenticated;
grant execute on function update_sale(
  uuid, date, sales_channel, text, text, text, numeric, numeric, numeric, sale_status, text, jsonb
) to authenticated;
