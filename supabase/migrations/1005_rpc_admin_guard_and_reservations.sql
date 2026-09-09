-- Heristiq — close two launch-blocking holes.
--
-- 1. Every SECURITY DEFINER RPC was callable by any signed-up user.
-- 2. A storefront order reserved nothing, so the last piece could be sold twice.
--
-- ================================================================
-- 1. The RPCs were a way around the admin boundary
--
-- Migration 1004 moved the ERP's boundary from "is signed in" to "is a listed
-- admin", and it did that with RLS policies. It did not revisit the FUNCTION
-- grants — and eight functions are SECURITY DEFINER, which by definition
-- bypasses RLS. Measured on a fresh database built from these migrations:
--
--   adjust_stock, deliver_pre_order, post_purchase, post_sale,
--   revalue_product_cost, save_pre_order, update_sale, void_sale
--
-- all `prosecdef = true`, all executable by `authenticated`, and none of them
-- checked who was calling. Since Supabase sign-ups are open by default, anyone
-- who registered could move stock, post and void sales, and rewrite product
-- costs — straight past the policies 1004 had just tightened.
--
-- They cannot simply become SECURITY INVOKER: `authenticated` holds ZERO table
-- privileges on products, product_stock, stock_movements, sales, sale_items,
-- purchases, purchase_items, pre_orders, pre_order_items and
-- cost_revaluations. That is deliberate and good — these RPCs are the only
-- write path into the ledger — and it is exactly why they are definer. So the
-- fix is a guard inside each one.
--
-- The bodies below are the existing bodies, extracted with pg_get_functiondef
-- from a database built from 0001-1004, with one line added after BEGIN.
-- Nothing else about them changed.
--
-- Note on service_role: the storefront only ever calls
-- place_storefront_order and apply_courier_status, neither of which is in this
-- list, so guarding these on admin membership cannot affect the shop.
-- ================================================================

/*
 * Raise unless the caller is a listed ERP admin.
 *
 * A procedure rather than a boolean so a caller cannot ignore the answer —
 * `perform require_erp_admin()` either continues or aborts the transaction.
 *
 * It inherits is_erp_admin()'s bootstrap: while erp_admins is EMPTY every
 * authenticated user passes, exactly as before this migration. That is the
 * same lesser evil documented in 1004 — failing closed on an empty table
 * locks the owner out of their own ERP with no way back through the UI. The
 * ERP shows an unmissable banner until the table is claimed. Disabling public
 * sign-ups in Supabase is still the first thing to do after applying this.
 */
create or replace function require_erp_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_erp_admin() then
    raise exception 'not authorised: ERP admin access required'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function require_erp_admin() from public;
grant execute on function require_erp_admin() to authenticated;

CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id uuid, p_qty_delta integer, p_unit_cost numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text, p_damage boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cost numeric(14,4);
begin
  perform require_erp_admin();
  if p_qty_delta = 0 then raise exception 'adjustment quantity cannot be zero'; end if;

  if p_qty_delta > 0 then
    cost := coalesce(p_unit_cost, (select avg_cost from product_stock where product_id = p_product_id), 0);
  else
    cost := coalesce((select avg_cost from product_stock where product_id = p_product_id), 0);
  end if;

  insert into stock_movements (product_id, type, qty_delta, unit_cost, note)
  values (
    p_product_id,
    case when p_damage and p_qty_delta < 0 then 'damage_out'::movement_type else 'adjustment'::movement_type end,
    p_qty_delta, cost, p_note
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.deliver_pre_order(p_pre_order_id uuid, p_delivery_charge numeric DEFAULT 0, p_delivery_cost numeric DEFAULT 0, p_channel sales_channel DEFAULT 'other'::sales_channel)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  po       pre_orders%rowtype;
  new_sale uuid;
  unpriced int;
begin
  perform require_erp_admin();
  select * into po from pre_orders where id = p_pre_order_id for update;
  if not found then raise exception 'pre-order % not found', p_pre_order_id; end if;

  if po.converted_sale_id is not null then
    raise exception 'this pre-order was already delivered as a sale';
  end if;
  if po.status = 'cancelled' then
    raise exception 'this pre-order is cancelled';
  end if;
  if coalesce(p_delivery_charge, 0) < 0 or coalesce(p_delivery_cost, 0) < 0 then
    raise exception 'delivery amounts cannot be negative';
  end if;

  if not exists (select 1 from pre_order_items where pre_order_id = p_pre_order_id) then
    raise exception 'this pre-order has no items';
  end if;

  -- A sale line needs a real product, because stock has to come from somewhere.
  select count(*) into unpriced
  from pre_order_items where pre_order_id = p_pre_order_id and product_id is null;

  if unpriced > 0 then
    raise exception
      '% item(s) are not linked to a catalogue product — add them to Products first',
      unpriced;
  end if;

  insert into sales (
    sale_date, channel, customer_name, customer_phone, customer_address,
    discount, delivery_charge, delivery_cost, status, note
  ) values (
    current_date, p_channel, po.customer_name, po.customer_phone, po.customer_address,
    0, coalesce(p_delivery_charge, 0), coalesce(p_delivery_cost, 0), 'delivered',
    'Delivered from pre-order' ||
      case when po.note is null then '' else ' — ' || po.note end
  )
  returning id into new_sale;

  -- Group by product: sale_items carries one line per product (0006), and a
  -- customer may well have asked for the same thing on two lines.
  insert into sale_items (sale_id, product_id, qty, unit_price)
  select new_sale, product_id, sum(qty),
         round(sum(qty * unit_price) / nullif(sum(qty), 0), 2)
  from pre_order_items
  where pre_order_id = p_pre_order_id
  group by product_id;

  perform post_sale(new_sale);

  update pre_orders
     set status = 'fulfilled', converted_sale_id = new_sale
   where id = p_pre_order_id;

  return new_sale;
end;
$function$;

CREATE OR REPLACE FUNCTION public.post_purchase(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p           purchases%rowtype;
  total_value numeric(14,4);
  extra       numeric(14,4);
  item        record;
  share       numeric(14,4);
  landed      numeric(14,4);
begin
  perform require_erp_admin();
  select * into p from purchases where id = p_purchase_id for update;
  if not found then raise exception 'purchase % not found', p_purchase_id; end if;
  if p.posted then raise exception 'purchase % is already posted', p_purchase_id; end if;

  select coalesce(sum(qty * unit_cost), 0) into total_value
  from purchase_items where purchase_id = p_purchase_id;

  if total_value = 0 then raise exception 'purchase % has no lines', p_purchase_id; end if;

  extra := p.freight_cost + p.import_cost + p.other_cost;

  for item in select * from purchase_items where purchase_id = p_purchase_id loop
    share  := extra * ((item.qty * item.unit_cost) / total_value);
    landed := item.unit_cost + (share / item.qty);

    update purchase_items
       set allocated_extra = share, unit_landed_cost = landed
     where id = item.id;

    insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
    values (item.product_id, 'purchase_in', item.qty, landed, 'purchases', p_purchase_id, 'purchase posted');
  end loop;

  update purchases set posted = true, posted_at = now() where id = p_purchase_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.post_sale(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s    sales%rowtype;
  item record;
  cost numeric(14,4);
begin
  perform require_erp_admin();
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'sale % not found', p_sale_id; end if;
  if s.posted then raise exception 'sale % is already posted', p_sale_id; end if;
  if s.status in ('cancelled','returned') then
    raise exception 'sale % is %, so it cannot be posted', p_sale_id, s.status;
  end if;

  if not exists (select 1 from sale_items where sale_id = p_sale_id) then
    raise exception 'sale % has no lines', p_sale_id;
  end if;

  for item in select * from sale_items where sale_id = p_sale_id loop
    select coalesce(avg_cost, 0) into cost from product_stock where product_id = item.product_id;
    cost := coalesce(cost, 0);

    update sale_items set unit_cost = cost where id = item.id;

    insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
    values (item.product_id, 'sale_out', -item.qty, cost, 'sales', p_sale_id, 'sale posted');
  end loop;

  update sales set posted = true, posted_at = now() where id = p_sale_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.revalue_product_cost(p_product_id uuid, p_new_cost numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cur_cost    numeric(14,4);
  cur_on_hand integer;
begin
  perform require_erp_admin();
  if p_new_cost is null or p_new_cost < 0 then
    raise exception 'cost must be zero or more';
  end if;

  insert into product_stock (product_id) values (p_product_id)
  on conflict (product_id) do nothing;

  select avg_cost, on_hand into cur_cost, cur_on_hand
  from product_stock where product_id = p_product_id for update;

  -- numeric(14,4), so compare at the stored precision rather than exactly.
  if round(cur_cost, 4) = round(p_new_cost, 4) then
    return;
  end if;

  insert into cost_revaluations (product_id, old_cost, new_cost, on_hand, note)
  values (p_product_id, cur_cost, p_new_cost, cur_on_hand, p_note);

  update product_stock set avg_cost = p_new_cost where product_id = p_product_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_pre_order(p_id uuid, p_customer_name text, p_customer_phone text, p_customer_address text, p_amount_paid numeric, p_order_date date, p_expected_date date, p_status pre_order_status, p_note text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  target uuid := p_id;
  total  numeric(12,2);
  phone  text;
begin
  perform require_erp_admin();
  if nullif(trim(coalesce(p_customer_name,'')), '') is null then
    raise exception 'customer name is required';
  end if;

  phone := normalise_bd_phone(p_customer_phone);
  if phone is null then
    raise exception
      'enter a valid mobile number — 11 digits starting 01, e.g. 01712345678 (got %)',
      coalesce(p_customer_phone, '(blank)');
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'add at least one item';
  end if;
  if coalesce(p_amount_paid, 0) < 0 then
    raise exception 'amount paid cannot be negative';
  end if;

  if target is null then
    insert into pre_orders (
      customer_name, customer_phone, customer_address,
      amount_paid, order_date, expected_date, status, note
    ) values (
      trim(p_customer_name), phone, nullif(trim(coalesce(p_customer_address,'')), ''),
      0, coalesce(p_order_date, current_date), p_expected_date,
      coalesce(p_status, 'pending'), nullif(trim(coalesce(p_note,'')), '')
    )
    returning id into target;
  else
    if exists (select 1 from pre_orders where id = target and converted_sale_id is not null) then
      raise exception 'this pre-order was already delivered, so it can no longer be changed';
    end if;

    update pre_orders set
      customer_name    = trim(p_customer_name),
      customer_phone   = phone,
      customer_address = nullif(trim(coalesce(p_customer_address,'')), ''),
      order_date       = coalesce(p_order_date, order_date),
      expected_date    = p_expected_date,
      status           = coalesce(p_status, status),
      note             = nullif(trim(coalesce(p_note,'')), '')
    where id = target;

    if not found then raise exception 'pre-order % not found', target; end if;
  end if;

  delete from pre_order_items where pre_order_id = target;

  insert into pre_order_items (pre_order_id, product_id, item_note, qty, unit_price)
  select target,
         nullif(l->>'product_id','')::uuid,
         nullif(trim(coalesce(l->>'item_note','')), ''),
         greatest(1, coalesce((l->>'qty')::int, 1)),
         greatest(0, coalesce((l->>'unit_price')::numeric, 0))
  from jsonb_array_elements(p_lines) l;

  select total_amount into total from pre_orders where id = target;
  update pre_orders
     set amount_paid = least(coalesce(p_amount_paid, 0), total)
   where id = target;

  return target;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_sale(p_sale_id uuid, p_sale_date date, p_channel sales_channel, p_customer_name text, p_customer_phone text, p_customer_address text, p_discount numeric, p_delivery_charge numeric, p_delivery_cost numeric, p_status sale_status, p_note text, p_lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s        sales%rowtype;
  ln       record;
  old_qty  integer;
  old_cost numeric(14,4);
  cur_cost numeric(14,4);
  delta    integer;
  new_cost numeric(14,4);
begin
  perform require_erp_admin();
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'sale % not found', p_sale_id; end if;

  if s.status in ('cancelled','returned') then
    raise exception 'sale % is % — reverse it first if you need to change it', p_sale_id, s.status;
  end if;

  if p_status in ('cancelled','returned') then
    raise exception 'use the Cancel or Return action so stock goes back correctly';
  end if;

  if jsonb_array_length(p_lines) = 0 then
    raise exception 'a sale needs at least one product line';
  end if;

  update sales set
    sale_date        = p_sale_date,
    channel          = p_channel,
    customer_name    = p_customer_name,
    customer_phone   = p_customer_phone,
    customer_address = p_customer_address,
    discount         = p_discount,
    delivery_charge  = p_delivery_charge,
    delivery_cost    = p_delivery_cost,
    status           = p_status,
    note             = p_note
  where id = p_sale_id;

  -- Unposted sale: no ledger to correct, so just replace the lines.
  if not s.posted then
    delete from sale_items where sale_id = p_sale_id;
    insert into sale_items (sale_id, product_id, qty, unit_price)
    select p_sale_id, (l->>'product_id')::uuid, (l->>'qty')::int, (l->>'unit_price')::numeric
    from jsonb_array_elements(p_lines) l;
    return;
  end if;

  -- Posted: reconcile each product against what is already on the sale.
  for ln in
    select (l->>'product_id')::uuid  as product_id,
           (l->>'qty')::int          as qty,
           (l->>'unit_price')::numeric as unit_price
    from jsonb_array_elements(p_lines) l
  loop
    if ln.qty <= 0 then raise exception 'quantity must be at least 1'; end if;

    select qty, unit_cost into old_qty, old_cost
    from sale_items where sale_id = p_sale_id and product_id = ln.product_id;

    select coalesce(avg_cost, 0) into cur_cost
    from product_stock where product_id = ln.product_id;
    cur_cost := coalesce(cur_cost, 0);

    if old_qty is null then
      -- Product added to the sale: goes out now, at today's cost.
      insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
      values (ln.product_id, 'sale_out', -ln.qty, cur_cost, 'sales', p_sale_id, 'sale edited — line added');

      insert into sale_items (sale_id, product_id, qty, unit_price, unit_cost)
      values (p_sale_id, ln.product_id, ln.qty, ln.unit_price, cur_cost);
    else
      delta := ln.qty - old_qty;

      if delta > 0 then
        -- More units leaving. Blend so unit_cost reflects both batches.
        insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
        values (ln.product_id, 'sale_out', -delta, cur_cost, 'sales', p_sale_id, 'sale edited — quantity raised');
        new_cost := ((old_qty * old_cost) + (delta * cur_cost)) / ln.qty;
      elsif delta < 0 then
        -- Units coming back, at the cost they left at.
        insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
        values (ln.product_id, 'return_in', -delta, old_cost, 'sales', p_sale_id, 'sale edited — quantity lowered');
        new_cost := old_cost;
      else
        new_cost := old_cost;
      end if;

      update sale_items
         set qty = ln.qty, unit_price = ln.unit_price, unit_cost = new_cost
       where sale_id = p_sale_id and product_id = ln.product_id;
    end if;
  end loop;

  -- Products dropped from the sale entirely: everything comes back.
  for ln in
    select si.product_id, si.qty, si.unit_cost
    from sale_items si
    where si.sale_id = p_sale_id
      and si.product_id not in (
        select (l->>'product_id')::uuid from jsonb_array_elements(p_lines) l
      )
  loop
    insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
    values (ln.product_id, 'return_in', ln.qty, ln.unit_cost, 'sales', p_sale_id, 'sale edited — line removed');

    delete from sale_items where sale_id = p_sale_id and product_id = ln.product_id;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_status sale_status DEFAULT 'cancelled'::sale_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s    sales%rowtype;
  item record;
begin
  perform require_erp_admin();
  if p_status is null or p_status not in ('cancelled','returned') then
    raise exception 'void_sale only accepts cancelled or returned, got %', p_status;
  end if;

  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'sale % not found', p_sale_id; end if;

  if s.status in ('cancelled','returned') then
    raise exception 'sale % is already %', p_sale_id, s.status;
  end if;

  if not s.posted then
    update sales set status = p_status where id = p_sale_id;
    return;
  end if;

  for item in select * from sale_items where sale_id = p_sale_id loop
    insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
    values (item.product_id, 'return_in', item.qty, item.unit_cost, 'sales', p_sale_id, 'sale ' || p_status::text);
  end loop;

  update sales set status = p_status where id = p_sale_id;
end;
$function$;

-- ================================================================
-- 2. A storefront order now reserves its stock
--
-- 1001's own header says "the ERP's `reserved` count is what stops the drawer
-- being sold twice". It did not: v_reserved_stock derived `reserved` purely
-- from pre_order_items, so a customer's order on the website reserved
-- nothing. The shop kept showing the last piece as available, and two
-- customers could both buy it — on the first day, with no warning.
--
-- Fixed by teaching the view about open storefront orders. The storefront
-- reads `available` (on_hand - reserved) through v_product_stock, so this one
-- change closes the hole for the shop, the ERP's stock screen and the low
-- stock report at the same time.
--
-- Which statuses hold a reservation: everything from the moment the customer
-- presses the button until the parcel is out of our hands or the order is
-- dead. `delivered` stops reserving because delivery is what turns the order
-- into a sale and a real stock movement; `cancelled` and `returned` release
-- it. This deliberately does NOT decrement on_hand — the goods are still on
-- the shelf until they leave, and post_sale() is what records that.
-- ================================================================

create or replace view v_reserved_stock with (security_invoker = on) as
select product_id, sum(reserved)::int as reserved
from (
  -- ERP pre-orders, as before
  select i.product_id, sum(i.qty)::int as reserved
  from pre_order_items i
  join pre_orders po on po.id = i.pre_order_id
  where i.product_id is not null
    and po.status in ('pending','confirmed')
    and po.converted_sale_id is null
  group by i.product_id

  union all

  -- and now the website's own open orders
  select oi.product_id, sum(oi.qty)::int as reserved
  from storefront_order_items oi
  join storefront_orders o on o.id = oi.order_id
  where oi.product_id is not null
    and o.status in ('placed','confirmed','packed','handed_to_courier')
  group by oi.product_id
) both_sources
group by product_id;

grant select on v_reserved_stock to authenticated;
