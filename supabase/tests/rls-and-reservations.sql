-- Proves the two fixes in migration 1005, against a database built from
-- supabase/migrations/*.sql applied in filename order.
--
--   psql -d <db> -f supabase/tests/rls-and-reservations.sql
--
-- Expects, in order:
--   C1a  BLOCKED   — a signed-up non-admin cannot move stock
--   C1b  ALLOWED   — a listed admin still can
--   C2   5 -> 3 -> 5  — a website order reserves, delivery releases
--
-- Every check that mutates runs inside a transaction that rolls back, so this
-- is safe to run repeatedly against a scratch database. It is NOT for
-- production: it inserts a test product and a test admin.

\pset border 2
\set ON_ERROR_STOP on

-- ── fixtures ───────────────────────────────────────────────────────────────
insert into categories (name)
select 'Test category'
where not exists (select 1 from categories where name = 'Test category');

insert into products (sku, name, category_id, selling_price, reorder_level)
select 'TEST-1', 'Test chain', c.id, 300, 1
from categories c
where c.name = 'Test category'
  and not exists (select 1 from products where sku = 'TEST-1');

-- One named admin, so is_erp_admin() stops bootstrapping to "anyone".
insert into erp_admins (email)
select 'owner@heristiq.com'
where not exists (select 1 from erp_admins where email = 'owner@heristiq.com');

select id as pid from products where sku = 'TEST-1' \gset

delete from storefront_order_items
 where order_id in (select id from storefront_orders where customer_phone = '01911100001');
delete from storefront_orders where customer_phone = '01911100001';
update product_stock set on_hand = 5, avg_cost = 100 where product_id = :'pid';

-- ── C1: the SECURITY DEFINER RPCs are admin-only ──────────────────────────
\echo ''
\echo '=== C1a: a random signed-up user calls adjust_stock ==='
begin;
  -- the id has to travel via a setting: psql does not interpolate :'pid'
  -- inside a dollar-quoted block, and the argument of a definer function is
  -- evaluated as the CALLER, who has no grant on products.
  set local test.pid = :'pid';
  set local role authenticated;
  set local request.jwt.claims = '{"email":"randomsignup@gmail.com"}';
  do $$ begin
    perform adjust_stock(current_setting('test.pid')::uuid, 100, 50, 'steal', false);
    raise notice 'BAD — the call SUCCEEDED, stock was moved';
  exception
    when insufficient_privilege then raise notice 'BLOCKED — %', sqlerrm;
    when others then raise notice 'BLOCKED (other) — %', sqlerrm;
  end $$;
rollback;

\echo '=== C1b: the listed admin calls the same function ==='
begin;
  set local test.pid = :'pid';
  set local role authenticated;
  set local request.jwt.claims = '{"email":"owner@heristiq.com"}';
  do $$ begin
    perform adjust_stock(current_setting('test.pid')::uuid, 2, 100, 'restock', false);
    raise notice 'ALLOWED — the admin can still work';
  exception when others then raise notice 'BAD — the admin was blocked: %', sqlerrm; end $$;
rollback;

-- ── C2: a website order reserves its stock ────────────────────────────────
\echo ''
\echo '=== C2: available BEFORE any website order (expect 5) ==='
select on_hand, reserved, available from v_product_stock where sku = 'TEST-1';

\echo '=== C2: a customer orders 2 on the website ==='
select (place_storefront_order(jsonb_build_object(
  'customer_name','Test Customer','customer_phone','01911100001',
  'division','Dhaka','district','Dhaka','address_line','12 Test Rd',
  'payment_method','cod','payment_state','due_on_delivery',
  'subtotal',600,'delivery_fee',70,'discount',0,'total',670,'amount_paid',0,
  'has_pre_order',false,
  'lines', jsonb_build_array(jsonb_build_object(
    'product_id', :'pid', 'sku','TEST-1','name','Test chain',
    'qty',2,'unit_price',300,'is_pre_order',false))
))).reference as order_reference;

\echo '=== C2: available AFTER the order (expect 3) ==='
select on_hand, reserved, available from v_product_stock where sku = 'TEST-1';

\echo '=== C2: once delivered the reservation releases (expect 5) ==='
update storefront_orders set status = 'delivered' where customer_phone = '01911100001';
select on_hand, reserved, available from v_product_stock where sku = 'TEST-1';
