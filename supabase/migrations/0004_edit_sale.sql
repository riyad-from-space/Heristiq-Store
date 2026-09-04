-- Let a recorded sale be corrected.
--
-- Header fields (customer, date, channel, discount, delivery, note) are just an
-- update — they change revenue and profit but never touch stock.
--
-- Lines are the hard part. A posted sale has already written sale_out rows to
-- the ledger, and the ledger is append-only, so quantities cannot be rewritten.
-- Instead the change is expressed as a correcting movement: raising a line from
-- 4 to 6 writes a further sale_out of 2, lowering it to 2 writes a return_in of
-- 2 at the cost those units left at. The ledger stays a truthful record of what
-- moved and when.
--
-- Cancelling or returning still goes through void_sale() — the buttons on the
-- Sales page — because that reverses the whole sale in one movement per line.

create or replace function update_sale(
  p_sale_id          uuid,
  p_sale_date        date,
  p_channel          sales_channel,
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_address text,
  p_discount         numeric,
  p_delivery_charge  numeric,
  p_delivery_cost    numeric,
  p_status           sale_status,
  p_note             text,
  p_lines            jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s        sales%rowtype;
  ln       record;
  old_qty  integer;
  old_cost numeric(14,4);
  cur_cost numeric(14,4);
  delta    integer;
  new_cost numeric(14,4);
begin
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
$$;

grant execute on function update_sale(
  uuid, date, sales_channel, text, text, text, numeric, numeric, numeric, sale_status, text, jsonb
) to authenticated;
