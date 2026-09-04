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
