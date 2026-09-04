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
