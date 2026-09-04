-- Fixes from the audit. Four defects, one of them a regression from 0006.

-- ---------------------------------------------------------------------------
-- 1. void_sale accepted ANY status, including live ones.
--
-- The only guard checked the sale's CURRENT status, never the incoming one, so
-- void_sale(id, 'delivered') returned the stock while leaving the sale counted
-- as revenue — 'delivered' is not in the excluded set of v_daily_sales. And
-- because the terminal status was never reached, the already-voided guard never
-- engaged, so the same call could be repeated without limit, each time crediting
-- stock that does not exist. A server action is a public HTTP endpoint and its
-- FormData is entirely client-supplied, so this was reachable.
-- ---------------------------------------------------------------------------
create or replace function void_sale(p_sale_id uuid, p_status sale_status default 'cancelled')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s    sales%rowtype;
  item record;
begin
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
$$;

-- A cancelled sale must not be postable: post_sale would write sale_out rows that
-- void_sale can never reverse, because it refuses an already-terminal sale.
create or replace function post_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s    sales%rowtype;
  item record;
  cost numeric(14,4);
begin
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
$$;

-- ---------------------------------------------------------------------------
-- 2. REGRESSION from 0006: buying the same product twice in one shipment is
--    ordinary procurement — two cartons at two prices, or a price break on the
--    second tranche. post_purchase always handled it correctly, iterating every
--    row so the moving average blends both. The unique constraint turned a
--    working workflow into a raw 23505, and the compensating delete in
--    createPurchase then threw the whole entry away.
--
--    Sales are different: update_sale reconciles per product, reading one row
--    and writing all matching rows, so duplicates genuinely corrupt an edit.
--    That constraint stays.
-- ---------------------------------------------------------------------------
alter table purchase_items drop constraint if exists purchase_items_one_line_per_product;

-- 0006 merged duplicate purchase lines but left allocated_extra and
-- unit_landed_cost as the pre-merge figures on already-posted purchases. The
-- ledger movements were already written from the old values, so recomputing the
-- allocation would make the columns disagree with the stock that actually moved.
-- Recompute unit_landed_cost from the surviving row's own numbers instead, which
-- is the value that row now describes.
update purchase_items
   set unit_landed_cost = round(unit_cost + (allocated_extra / nullif(qty, 0)), 4)
 where qty > 0
   and unit_landed_cost <> round(unit_cost + (allocated_extra / nullif(qty, 0)), 4);

-- ---------------------------------------------------------------------------
-- 3. A recorded cost revaluation was silently discarded by a return.
--
--    apply_stock_movement treats ANY inbound movement at on_hand <= 0 as
--    authoritative. That is right for a purchase — the incoming price is the new
--    basis. It is wrong for a return_in, which carries sale_items.unit_cost, a
--    snapshot frozen at post time. So: revalue a sold-out product from 56 to 45,
--    then cancel the sale, and the return silently restored 56 while
--    cost_revaluations went on asserting 45. The audit trail lied.
--
--    Now only a purchase resets the basis at zero stock. A return re-enters
--    against the current cost when there is one.
-- ---------------------------------------------------------------------------
create or replace function apply_stock_movement()
returns trigger
language plpgsql
as $$
declare
  cur_on_hand int;
  cur_avg     numeric(14,4);
  new_on_hand int;
  new_avg     numeric(14,4);
begin
  insert into product_stock (product_id) values (new.product_id)
  on conflict (product_id) do nothing;

  select on_hand, avg_cost into cur_on_hand, cur_avg
  from product_stock where product_id = new.product_id for update;

  new_on_hand := cur_on_hand + new.qty_delta;

  if new.qty_delta > 0 then
    if cur_on_hand <= 0 then
      -- A purchase sets the basis. Anything else (a return, a positive
      -- adjustment) must not overwrite a cost that was deliberately set —
      -- only fall back to the movement's own cost when there is no basis yet.
      if new.type = 'purchase_in' or coalesce(cur_avg, 0) = 0 then
        new_avg := new.unit_cost;
      else
        new_avg := cur_avg;
      end if;
    else
      new_avg := (cur_on_hand * cur_avg + new.qty_delta * new.unit_cost) / new_on_hand;
    end if;
  else
    new_avg := cur_avg;
  end if;

  update product_stock
     set on_hand = new_on_hand,
         avg_cost = new_avg,
         last_movement_at = new.created_at
   where product_id = new.product_id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cost can never be negative. Nothing enforced it on the ledger or the cache,
--    and adjust_stock would accept a negative p_unit_cost straight through.
-- ---------------------------------------------------------------------------
alter table stock_movements
  add constraint stock_movements_unit_cost_non_negative check (unit_cost >= 0) not valid;
alter table stock_movements validate constraint stock_movements_unit_cost_non_negative;

alter table product_stock
  add constraint product_stock_avg_cost_non_negative check (avg_cost >= 0) not valid;
alter table product_stock validate constraint product_stock_avg_cost_non_negative;

-- ---------------------------------------------------------------------------
-- 5. A pre-order with no amounts yet read "unpaid, ৳0 due", which is misleading —
--    nothing is owed because no price has been set. Report it as its own state.
-- ---------------------------------------------------------------------------
create or replace view v_pre_orders with (security_invoker = on) as
select
  po.id, po.customer_name, po.customer_phone, po.product_id,
  p.name as product_name, p.sku as product_sku,
  po.item_note, po.qty, po.total_amount, po.amount_paid,
  round(po.total_amount - po.amount_paid, 2) as amount_due,
  case
    when po.total_amount = 0                  then 'no price yet'
    when po.amount_paid >= po.total_amount    then 'paid'
    when po.amount_paid > 0                   then 'partial'
    else 'unpaid'
  end as payment_status,
  po.order_date, po.expected_date, po.status, po.note,
  po.created_at, po.updated_at
from pre_orders po
left join products p on p.id = po.product_id;

grant select on v_pre_orders to authenticated;
