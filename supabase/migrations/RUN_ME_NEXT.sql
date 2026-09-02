-- ============================================================================
-- RUN THIS ONCE IN THE SUPABASE SQL EDITOR.
--
-- You have applied 0005 through 0010. This is 0011 to 0015.
--
--   0011  the fix 0005 should have been. 0005 revoked EXECUTE from PUBLIC, but
--         Supabase ALSO grants every function explicitly to `anon`, so the
--         privileged functions stayed callable with the public browser key.
--   0012  Deliver: turn a pre-order into a real sale in one click.
--   0013  Many items per pre-order, plus a delivery address.
--   0014  Atomic save, multi-item delivery, and reserved / available stock.
--   0015  Phone normalisation enforced in the database, not just the app.
--
-- Safe to run more than once.
-- ============================================================================


-- =========================== 0011_revoke_anon_execute.sql ===========================
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

-- =========================== 0012_deliver_pre_order.sql ===========================
-- Deliver a pre-order: turn it into a real sale, once, without re-typing it.
--
-- Until this runs, a pre-order touches NOTHING — no stock, no revenue, no
-- profit. It is a promise. Delivery is the moment goods actually move, so that
-- is the moment a sale exists and the ledger is written.
--
-- No new selling-price column is needed. total_amount is what the customer
-- pays for the goods, so the unit price is total / qty. That rarely divides
-- evenly (1000 over 3), so the unit price is rounded UP to the paisa and the
-- few paisa of overshoot become the sale's discount. items_total - discount
-- then equals the agreed total exactly, using fields the sale already has.
--
-- The advance in amount_paid is deliberately NOT carried over. A sale records
-- revenue at the point of delivery; when the cash arrived is a separate
-- question, and pre_orders keeps that history.

alter table pre_orders
  add column if not exists converted_sale_id uuid references sales(id) on delete set null;

create index if not exists pre_orders_converted_idx on pre_orders(converted_sale_id);

create or replace function deliver_pre_order(
  p_pre_order_id    uuid,
  p_delivery_charge numeric default 0,
  p_delivery_cost   numeric default 0,
  p_channel         sales_channel default 'other'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  po        pre_orders%rowtype;
  new_sale  uuid;
  unit      numeric(12,2);
  disc      numeric(12,2);
begin
  select * into po from pre_orders where id = p_pre_order_id for update;
  if not found then raise exception 'pre-order % not found', p_pre_order_id; end if;

  -- Idempotent: the link is the guard, so a double click cannot double-count.
  if po.converted_sale_id is not null then
    raise exception 'this pre-order was already delivered as a sale';
  end if;
  if po.status = 'cancelled' then
    raise exception 'this pre-order is cancelled';
  end if;
  if po.product_id is null then
    raise exception 'add a catalogue product to this pre-order before delivering it';
  end if;
  if po.total_amount <= 0 then
    raise exception 'set the total amount before delivering';
  end if;
  if coalesce(p_delivery_charge, 0) < 0 or coalesce(p_delivery_cost, 0) < 0 then
    raise exception 'delivery amounts cannot be negative';
  end if;

  -- Round the unit price UP so qty * unit >= total, then let the discount
  -- absorb the difference. discount has a >= 0 check, so rounding down would
  -- leave the sale short of the agreed price with no field able to correct it.
  unit := ceil((po.total_amount / po.qty) * 100) / 100;
  disc := (unit * po.qty) - po.total_amount;

  insert into sales (
    sale_date, channel, customer_name, customer_phone,
    discount, delivery_charge, delivery_cost, status, note
  ) values (
    current_date, p_channel, po.customer_name, po.customer_phone,
    disc, coalesce(p_delivery_charge, 0), coalesce(p_delivery_cost, 0), 'delivered',
    'Delivered from pre-order' ||
      case when po.note is null then '' else ' — ' || po.note end
  )
  returning id into new_sale;

  insert into sale_items (sale_id, product_id, qty, unit_price)
  values (new_sale, po.product_id, po.qty, unit);

  -- Snapshots cost and writes the stock ledger. This is the point at which the
  -- pre-order starts affecting inventory, revenue and profit.
  perform post_sale(new_sale);

  update pre_orders
     set status = 'fulfilled', converted_sale_id = new_sale
   where id = p_pre_order_id;

  return new_sale;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, so a new function is
-- reachable with the public browser key unless that is revoked explicitly.
revoke execute on function deliver_pre_order(uuid, numeric, numeric, sales_channel) from public;
revoke execute on function deliver_pre_order(uuid, numeric, numeric, sales_channel) from anon;
grant  execute on function deliver_pre_order(uuid, numeric, numeric, sales_channel) to authenticated;

-- Expose the link so the list can show it and hide the button once used.
create or replace view v_pre_orders with (security_invoker = on) as
select
  po.id, po.customer_name, po.customer_phone, po.product_id,
  p.name as product_name, p.sku as product_sku,
  po.item_note, po.qty, po.total_amount, po.amount_paid,
  round(po.total_amount - po.amount_paid, 2) as amount_due,
  case
    when po.total_amount = 0               then 'no price yet'
    when po.amount_paid >= po.total_amount then 'paid'
    when po.amount_paid > 0                then 'partial'
    else 'unpaid'
  end as payment_status,
  po.order_date, po.expected_date, po.status, po.note,
  po.created_at, po.updated_at,
  -- Appended, not inserted: create or replace view cannot reorder columns.
  po.converted_sale_id
from pre_orders po
left join products p on p.id = po.product_id;

grant select on v_pre_orders to authenticated;

-- =========================== 0013_pre_order_items.sql ===========================
-- Pre-orders: many items per order, a delivery address, and reserved stock.
--
-- 1. One customer orders several things at once, so items move to their own
--    table with a price each. Money that belongs to the ORDER — the advance —
--    stays on the header, because a customer pays one amount for the lot.
--
-- 2. A pre-ordered item is spoken for. It has not left the building, so the
--    ledger must not move — but it is not free to sell either. So `reserved`
--    and `available` are DERIVED alongside on_hand. Nothing is deducted; the
--    stock ledger stays exactly as truthful as before.
--
-- 3. A delivery address, which was being written into the note by hand.

alter table pre_orders add column if not exists customer_address text;

create table if not exists pre_order_items (
  id           uuid primary key default gen_random_uuid(),
  pre_order_id uuid not null references pre_orders(id) on delete cascade,
  product_id   uuid references products(id) on delete restrict,
  item_note    text,                       -- for something not in the catalogue
  qty          integer not null default 1 check (qty > 0),
  unit_price   numeric(12,2) not null default 0 check (unit_price >= 0),
  constraint pre_order_items_has_item
    check (product_id is not null or nullif(trim(coalesce(item_note,'')), '') is not null)
);

create index if not exists pre_order_items_order_idx   on pre_order_items(pre_order_id);
create index if not exists pre_order_items_product_idx on pre_order_items(product_id);

-- Carry the existing single-item pre-orders across before the columns go.
insert into pre_order_items (pre_order_id, product_id, item_note, qty, unit_price)
select po.id, po.product_id, po.item_note, po.qty,
       case when po.qty > 0 then round(po.total_amount / po.qty, 2) else 0 end
from pre_orders po
where not exists (select 1 from pre_order_items i where i.pre_order_id = po.id)
  and (po.product_id is not null or nullif(trim(coalesce(po.item_note,'')), '') is not null);

-- total_amount becomes a trigger-maintained cache over the lines, the same
-- pattern product_stock uses over the ledger: one place computes it, so the
-- header and the lines cannot disagree.
alter table pre_orders drop constraint if exists pre_orders_paid_within_total;
alter table pre_orders drop constraint if exists pre_orders_has_item;

create or replace function refresh_pre_order_total()
returns trigger language plpgsql as $$
declare
  target uuid := coalesce(new.pre_order_id, old.pre_order_id);
begin
  update pre_orders
     set total_amount = coalesce(
           (select round(sum(qty * unit_price), 2) from pre_order_items where pre_order_id = target), 0)
   where id = target;
  return null;
end;
$$;

drop trigger if exists pre_order_items_total on pre_order_items;
create trigger pre_order_items_total
after insert or update or delete on pre_order_items
for each row execute function refresh_pre_order_total();

-- Backfill for the rows just migrated.
update pre_orders po
   set total_amount = coalesce(
     (select round(sum(qty * unit_price), 2) from pre_order_items i where i.pre_order_id = po.id), 0);

-- The view reads the columns about to go, so it has to be dropped first and is
-- rebuilt in its multi-item shape in 0014.
drop view if exists v_pre_orders;

alter table pre_orders drop column if exists product_id;
alter table pre_orders drop column if exists item_note;
alter table pre_orders drop column if exists qty;

alter table pre_order_items enable row level security;
drop policy if exists pre_order_items_authenticated_all on public.pre_order_items;
create policy pre_order_items_authenticated_all on public.pre_order_items
  for all to authenticated using (true) with check (true);

-- =========================== 0014_pre_order_rpcs.sql ===========================
-- Atomic save and delivery for multi-item pre-orders, plus reserved stock.

-- ---------------------------------------------------------------------------
-- v_pre_orders, rebuilt for many items. The header carries the customer and
-- the one advance they paid; the items are summarised so a list row can be
-- rendered without a second query, and read in full on the detail page.
-- ---------------------------------------------------------------------------
create or replace view v_pre_orders with (security_invoker = on) as
select
  po.id,
  po.customer_name,
  po.customer_phone,
  po.customer_address,
  po.total_amount,
  po.amount_paid,
  round(po.total_amount - po.amount_paid, 2) as amount_due,
  case
    when po.total_amount = 0               then 'no price yet'
    when po.amount_paid >= po.total_amount then 'paid'
    when po.amount_paid > 0                then 'partial'
    else 'unpaid'
  end as payment_status,
  po.order_date, po.expected_date, po.status, po.note,
  po.created_at, po.updated_at, po.converted_sale_id,
  coalesce(it.item_count, 0)  as item_count,
  coalesce(it.total_qty, 0)   as total_qty,
  it.summary,
  coalesce(it.unlinked, 0)    as unlinked_items
from pre_orders po
left join (
  select
    i.pre_order_id,
    count(*)::int                                         as item_count,
    sum(i.qty)::int                                       as total_qty,
    count(*) filter (where i.product_id is null)::int     as unlinked,
    string_agg(
      i.qty || ' x ' || coalesce(p.name, i.item_note, 'item'),
      ', ' order by coalesce(p.name, i.item_note)
    )                                                     as summary
  from pre_order_items i
  left join products p on p.id = i.product_id
  group by i.pre_order_id
) it on it.pre_order_id = po.id;

grant select on v_pre_orders to authenticated;

create or replace view v_pre_order_items with (security_invoker = on) as
select
  i.id, i.pre_order_id, i.product_id,
  p.name as product_name, p.sku as product_sku,
  i.item_note, i.qty, i.unit_price,
  round(i.qty * i.unit_price, 2) as line_total,
  coalesce(ps.on_hand, 0) as on_hand
from pre_order_items i
left join products      p  on p.id = i.product_id
left join product_stock ps on ps.product_id = i.product_id;

grant select on v_pre_order_items to authenticated;

-- ---------------------------------------------------------------------------
-- One call writes the header and all its lines, so a part-written pre-order
-- cannot exist. Also used for edits: lines are replaced wholesale, which is
-- safe precisely because a pre-order has no ledger behind it.
-- ---------------------------------------------------------------------------
create or replace function save_pre_order(
  p_id               uuid,           -- null to create
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_amount_paid      numeric,
  p_order_date       date,
  p_expected_date    date,
  p_status           pre_order_status,
  p_note             text,
  p_lines            jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := p_id;
  total  numeric(12,2);
begin
  if nullif(trim(coalesce(p_customer_name,'')), '') is null then
    raise exception 'customer name is required';
  end if;
  if nullif(trim(coalesce(p_customer_phone,'')), '') is null then
    raise exception 'contact number is required';
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
      trim(p_customer_name), trim(p_customer_phone), nullif(trim(coalesce(p_customer_address,'')), ''),
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
      customer_phone   = trim(p_customer_phone),
      customer_address = nullif(trim(coalesce(p_customer_address,'')), ''),
      order_date       = coalesce(p_order_date, order_date),
      expected_date    = p_expected_date,
      status           = coalesce(p_status, status),
      note             = nullif(trim(coalesce(p_note,'')), '')
    where id = target;

    if not found then raise exception 'pre-order % not found', target; end if;
  end if;

  -- Replace the lines. Safe to delete: a pre-order has written no ledger, so
  -- there is nothing derived from these rows to preserve.
  delete from pre_order_items where pre_order_id = target;

  insert into pre_order_items (pre_order_id, product_id, item_note, qty, unit_price)
  select target,
         nullif(l->>'product_id','')::uuid,
         nullif(trim(coalesce(l->>'item_note','')), ''),
         greatest(1, coalesce((l->>'qty')::int, 1)),
         greatest(0, coalesce((l->>'unit_price')::numeric, 0))
  from jsonb_array_elements(p_lines) l;

  -- The trigger has now recomputed total_amount; clamp the advance to it, since
  -- taking more than the order is worth is a data-entry slip.
  select total_amount into total from pre_orders where id = target;
  update pre_orders
     set amount_paid = least(coalesce(p_amount_paid, 0), total)
   where id = target;

  return target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delivery, now across every line. Each line carries its own price, so the
-- rounding trick 0012 needed is gone — no derived unit price, no residual
-- discount.
-- ---------------------------------------------------------------------------
create or replace function deliver_pre_order(
  p_pre_order_id    uuid,
  p_delivery_charge numeric default 0,
  p_delivery_cost   numeric default 0,
  p_channel         sales_channel default 'other'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  po       pre_orders%rowtype;
  new_sale uuid;
  unpriced int;
begin
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
$$;

revoke execute on function save_pre_order(
  uuid, text, text, text, numeric, date, date, pre_order_status, text, jsonb) from public, anon;
grant  execute on function save_pre_order(
  uuid, text, text, text, numeric, date, date, pre_order_status, text, jsonb) to authenticated;

revoke execute on function deliver_pre_order(uuid, numeric, numeric, sales_channel) from public, anon;
grant  execute on function deliver_pre_order(uuid, numeric, numeric, sales_channel) to authenticated;

-- ---------------------------------------------------------------------------
-- Reserved and available stock.
--
-- An open pre-order has claimed goods that are still on the shelf. on_hand
-- stays the physical truth; `available` is what you can still promise someone.
-- Nothing is deducted, so the ledger is untouched.
-- ---------------------------------------------------------------------------
create or replace view v_reserved_stock with (security_invoker = on) as
select i.product_id, sum(i.qty)::int as reserved
from pre_order_items i
join pre_orders po on po.id = i.pre_order_id
where i.product_id is not null
  and po.status in ('pending','confirmed')     -- fulfilled has become a sale
  and po.converted_sale_id is null
group by i.product_id;

grant select on v_reserved_stock to authenticated;

create or replace view v_product_stock with (security_invoker = on) as
select
  p.id, p.sku, p.name, p.is_active, p.selling_price, p.reorder_level,
  c.name as category, s.name as supplier,
  coalesce(ps.on_hand, 0)  as on_hand,
  coalesce(ps.avg_cost, 0) as avg_cost,
  round(coalesce(ps.on_hand, 0) * coalesce(ps.avg_cost, 0), 2) as stock_value,
  round(p.selling_price - coalesce(ps.avg_cost, 0), 2)         as unit_margin,
  case when p.selling_price > 0
       then round(((p.selling_price - coalesce(ps.avg_cost, 0)) / p.selling_price) * 100, 1)
  end as margin_pct,
  ps.last_movement_at,
  coalesce(r.reserved, 0) as reserved,
  coalesce(ps.on_hand, 0) - coalesce(r.reserved, 0) as available
from products p
left join product_stock   ps on ps.product_id = p.id
left join categories      c  on c.id = p.category_id
left join suppliers       s  on s.id = p.supplier_id
left join v_reserved_stock r  on r.product_id = p.id;

-- Low stock should react to what is actually free to sell.
create or replace view v_low_stock with (security_invoker = on) as
select * from v_product_stock
where is_active and available <= reorder_level
order by available asc, name asc;

-- =========================== 0015_normalise_phone_in_db.sql ===========================
-- Normalise and validate the phone in the database, not only in the app.
--
-- save_pre_order only trimmed. The TypeScript action normalises before calling,
-- so the app path was fine — but a direct RPC call stored whatever it was given,
-- which means the same number could be saved two ways and never match on search.
-- The rule now lives in one place that every path goes through.

create or replace function normalise_bd_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw is null then return null; end if;
  digits := regexp_replace(raw, '[\s\-()]', '', 'g');
  digits := regexp_replace(digits, '^\+?880', '0');
  if digits ~ '^01[3-9][0-9]{8}$' then
    return digits;
  end if;
  return null;
end;
$$;

create or replace function save_pre_order(
  p_id               uuid,
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_amount_paid      numeric,
  p_order_date       date,
  p_expected_date    date,
  p_status           pre_order_status,
  p_note             text,
  p_lines            jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := p_id;
  total  numeric(12,2);
  phone  text;
begin
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
$$;

-- Tidy any number already stored in a non-canonical form.
update pre_orders
   set customer_phone = normalise_bd_phone(customer_phone)
 where normalise_bd_phone(customer_phone) is not null
   and normalise_bd_phone(customer_phone) <> customer_phone;

revoke execute on function normalise_bd_phone(text) from public, anon;
revoke execute on function save_pre_order(
  uuid, text, text, text, numeric, date, date, pre_order_status, text, jsonb) from public, anon;
grant  execute on function save_pre_order(
  uuid, text, text, text, numeric, date, date, pre_order_status, text, jsonb) to authenticated;
