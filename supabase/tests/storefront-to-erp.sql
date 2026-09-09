-- Proves migration 1006: a website order reaches the ERP ledger.
--
--   psql -d <db> -f supabase/tests/storefront-to-erp.sql
--
-- Covers the case that exercises every edge at once: a MIXED basket — one
-- piece in stock, one to be pre-ordered — because that is where reservations
-- can double-count and where the sale/pre-order split has to be right.
--
-- Expected, in order:
--   1  a pre_orders row appears, linked, holding only the pre-order line
--   2  reserved counts each line exactly once (not twice)
--   3  converting before delivery is REFUSED
--   4  a non-admin cannot convert
--   5  after delivery an admin gets a posted sale with both lines
--   6  converting twice is REFUSED
--   7  stock has moved once, and the pre-order is fulfilled

\pset border 2
\set ON_ERROR_STOP on

-- ── fixtures ───────────────────────────────────────────────────────────────
insert into categories (name) select 'T' where not exists (select 1 from categories where name='T');
insert into products (sku, name, category_id, selling_price, reorder_level)
select 'IN-1','In stock piece', c.id, 300, 1 from categories c where c.name='T'
  and not exists (select 1 from products where sku='IN-1');
insert into products (sku, name, category_id, selling_price, reorder_level)
select 'PRE-1','Pre-order piece', c.id, 500, 1 from categories c where c.name='T'
  and not exists (select 1 from products where sku='PRE-1');
insert into erp_admins (email) select 'owner@heristiq.com'
  where not exists (select 1 from erp_admins where email='owner@heristiq.com');

select id as in_id  from products where sku='IN-1'  \gset
select id as pre_id from products where sku='PRE-1' \gset

update product_stock set on_hand=10, avg_cost=120 where product_id=:'in_id';
update product_stock set on_hand=0,  avg_cost=200 where product_id=:'pre_id';

\echo ''
\echo '=== a customer orders 2 in-stock + 1 pre-order ==='
select (place_storefront_order(jsonb_build_object(
  'customer_name','Mixed Basket','customer_phone','01977700011',
  'division','Dhaka','district','Dhaka','area','Banani',
  'address_line','House 42, Road 7','landmark','Beside the mosque',
  'payment_method','manual_bkash','payment_state','advance_pending_verification',
  'subtotal',1100,'delivery_fee',70,'discount',0,'total',1170,'amount_paid',0,
  'has_pre_order',true,
  'lines', jsonb_build_array(
    jsonb_build_object('product_id',:'in_id','sku','IN-1','name','In stock piece',
                       'qty',2,'unit_price',300,'is_pre_order',false),
    jsonb_build_object('product_id',:'pre_id','sku','PRE-1','name','Pre-order piece',
                       'qty',1,'unit_price',500,'is_pre_order',true))
))).reference as order_reference;

select id as order_id from storefront_orders where customer_phone='01977700011' \gset

\echo '=== 1. the ERP now has a linked pre-order, with ONLY the pre-order line ==='
select po.status, po.total_amount, po.note,
       (select count(*) from pre_order_items i where i.pre_order_id = po.id) as lines,
       (select string_agg(p.sku, ',') from pre_order_items i
          join products p on p.id = i.product_id where i.pre_order_id = po.id) as skus
from pre_orders po where po.storefront_order_id = :'order_id';

\echo '=== 2. reserved counts each line ONCE (expect IN-1 2, PRE-1 1) ==='
select sku, on_hand, reserved, available from v_product_stock
where sku in ('IN-1','PRE-1') order by sku;

\echo '=== 3. converting before delivery is refused ==='
begin;
  -- the id travels via a setting: psql does not interpolate :'order_id'
  -- inside a dollar-quoted block
  set local t.oid = :'order_id';
  set local request.jwt.claims = '{"email":"owner@heristiq.com"}';
  do $$ begin
    perform convert_storefront_order_to_sale(current_setting('t.oid')::uuid);
    raise notice 'BAD — it converted an undelivered order';
  exception when others then raise notice 'REFUSED — %', sqlerrm; end $$;
rollback;

\echo '=== 4. a non-admin cannot convert ==='
begin;
  set local t.oid = :'order_id';
  set local role authenticated;
  set local request.jwt.claims = '{"email":"randomsignup@gmail.com"}';
  do $$ begin
    perform convert_storefront_order_to_sale(current_setting('t.oid')::uuid);
    raise notice 'BAD — a non-admin converted it';
  exception when others then raise notice 'REFUSED — %', sqlerrm; end $$;
rollback;

\echo '=== 5. delivered: an admin records the sale ==='
update storefront_orders set status='delivered' where id=:'order_id';
begin;
  set local t.oid = :'order_id';
  set local role authenticated;
  set local request.jwt.claims = '{"email":"owner@heristiq.com"}';
  do $$
  declare v uuid;
  begin
    v := convert_storefront_order_to_sale(current_setting('t.oid')::uuid);
    raise notice 'SALE CREATED %', v;
  exception when others then raise notice 'BAD — %', sqlerrm; end $$;
commit;

select s.posted, s.delivery_charge, s.note,
       (select count(*) from sale_items i where i.sale_id = s.id) as lines,
       (select sum(i.qty * i.unit_price) from sale_items i where i.sale_id = s.id) as line_total
from sales s where s.storefront_order_id = :'order_id';

\echo '=== 6. converting a second time is refused ==='
begin;
  set local t.oid = :'order_id';
  set local role authenticated;
  set local request.jwt.claims = '{"email":"owner@heristiq.com"}';
  do $$ begin
    perform convert_storefront_order_to_sale(current_setting('t.oid')::uuid);
    raise notice 'BAD — it converted twice, revenue is now double-counted';
  exception when others then raise notice 'REFUSED — %', sqlerrm; end $$;
rollback;

\echo '=== 7. stock moved once, and the pre-order is fulfilled ==='
select sku, on_hand, reserved, available from v_product_stock
where sku in ('IN-1','PRE-1') order by sku;
select status, converted_sale_id is not null as linked_to_sale
from pre_orders where storefront_order_id = :'order_id';
