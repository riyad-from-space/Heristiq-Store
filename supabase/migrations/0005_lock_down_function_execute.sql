-- SECURITY: stop unauthenticated callers executing the privileged functions.
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default. The earlier
-- migrations granted to `authenticated` but never revoked that default, so the
-- grant was additive, not restrictive — PUBLIC kept its own EXECUTE.
--
-- All six functions are SECURITY DEFINER, so they run as the owner and bypass RLS.
-- The anon key ships in the browser bundle at a public URL, which meant anyone who
-- read the page source could call them against live data:
--
--   select adjust_stock(<product>, 9999, ...)         -- rewrite stock
--   select revalue_product_cost(<product>, 1.00, ...) -- rewrite cost
--   select void_sale(<sale>, 'cancelled')             -- cancel any sale
--
-- Verified as the `anon` role on Postgres 17: reads were correctly blocked with
-- "permission denied for table products", but both writes above succeeded.
--
-- Revoking from PUBLIC leaves the explicit `authenticated` grants in place, so the
-- app is unaffected. Signed-in users keep exactly the access they had.

revoke execute on function post_purchase(uuid)                                  from public;
revoke execute on function post_sale(uuid)                                      from public;
revoke execute on function void_sale(uuid, sale_status)                         from public;
revoke execute on function adjust_stock(uuid, int, numeric, text, boolean)      from public;
revoke execute on function revalue_product_cost(uuid, numeric, text)            from public;
revoke execute on function update_sale(
  uuid, date, sales_channel, text, text, text, numeric, numeric, numeric, sale_status, text, jsonb
) from public;

-- The internal trigger functions are not callable over the API, but they are
-- SECURITY INVOKER and harmless; left alone deliberately.

-- Re-assert the intended grants so this file is self-contained and idempotent.
grant execute on function post_purchase(uuid)                                   to authenticated;
grant execute on function post_sale(uuid)                                       to authenticated;
grant execute on function void_sale(uuid, sale_status)                          to authenticated;
grant execute on function adjust_stock(uuid, int, numeric, text, boolean)       to authenticated;
grant execute on function revalue_product_cost(uuid, numeric, text)             to authenticated;
grant execute on function update_sale(
  uuid, date, sales_channel, text, text, text, numeric, numeric, numeric, sale_status, text, jsonb
) to authenticated;
