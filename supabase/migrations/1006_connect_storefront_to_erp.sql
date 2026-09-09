-- Heristiq — connect the storefront to the ERP ledger.
--
-- Two gaps this closes, both found in the pre-launch audit. Neither was a bug
-- in the sense of broken code: both were documented intentions that no code
-- ever implemented, which is a worse failure mode because the comments read
-- as though the work was done.
--
--   1. A delivered website order never became an ERP sale, so revenue, COGS,
--      profit and stock excluded every online order. The owner would have had
--      to re-key each one on the Sales screen.
--   2. A website pre-order created nothing the ERP's pre-orders module could
--      see: the module reads pre_orders, the storefront set a has_pre_order
--      boolean on its own table. Two unconnected concepts for one idea.
--
-- The design choice in both: an EXPLICIT, idempotent, admin-only step, linked
-- by a unique foreign key. Nothing here happens automatically on a status
-- change, because "delivered" is a button a tired person taps on a phone and
-- a stock movement is not something to write by accident.

-- ================================================================
-- 1. The links
--
-- A unique FK in each direction-of-record, which buys idempotency for free:
-- a second conversion of the same order cannot insert a second sale, the
-- constraint refuses it. That matters more than it sounds — "did I already
-- record this one?" is exactly the question a busy owner cannot answer, and
-- double-posting a sale would double-count revenue AND move stock twice.
--
-- `on delete set null` rather than cascade: deleting a website order must
-- never delete the accounting record of money that was actually taken.
-- ================================================================

alter table sales
  add column if not exists storefront_order_id uuid unique
    references storefront_orders(id) on delete set null;

alter table pre_orders
  add column if not exists storefront_order_id uuid unique
    references storefront_orders(id) on delete set null;

comment on column sales.storefront_order_id is
  'Set when this sale was created from a website order. Unique, so an order '
  'can only ever produce one sale. Null for sales entered by hand.';

comment on column pre_orders.storefront_order_id is
  'Set when this pre-order came from the website rather than a DM.';

create index if not exists sales_storefront_order_idx
  on sales(storefront_order_id) where storefront_order_id is not null;
create index if not exists pre_orders_storefront_order_idx
  on pre_orders(storefront_order_id) where storefront_order_id is not null;

-- ================================================================
-- 2. A website pre-order becomes a real ERP pre-order, at once
--
-- Done inside place_storefront_order so it shares the order's transaction:
-- either the customer has an order and the owner has a pre-order to fulfil,
-- or neither exists. A separate step could fail after the order was taken and
-- leave a promise nobody could see.
--
-- Only the pre-order LINES go into it. A mixed basket — one piece in stock,
-- one to be made — is one website order, one sale later for the in-stock
-- part, and one pre-order for the rest. Putting the whole basket into the
-- pre-order would reserve stock twice for the in-stock line.
--
-- amount_paid comes from the order and is 0 at this point by design: the
-- customer has claimed a bKash TrxID, and a claim is not money until the
-- owner checks it. The storefront order stays the source of truth for
-- payment state; the ERP's verifyAdvance is what confirms it.
-- ================================================================

create or replace function place_storefront_order(p jsonb)
returns table (id uuid, reference text, public_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order storefront_orders;
  v_line  jsonb;
  v_pre_total numeric(12,2);
  v_pre_id uuid;
begin
  insert into storefront_orders (
    customer_name, customer_phone, phone_verified_at,
    division, district, area, address_line, landmark,
    courier_preference, payment_method, payment_state,
    subtotal, delivery_fee, discount, total, amount_paid,
    has_pre_order, customer_note
  ) values (
    p->>'customer_name',
    p->>'customer_phone',
    (p->>'phone_verified_at')::timestamptz,
    p->>'division',
    p->>'district',
    nullif(p->>'area', ''),
    p->>'address_line',
    nullif(p->>'landmark', ''),
    nullif(p->>'courier_preference', '')::storefront_courier,
    coalesce(nullif(p->>'payment_method', ''), 'cod')::storefront_payment_method,
    coalesce(nullif(p->>'payment_state', ''), 'due_on_delivery')::storefront_payment_state,
    (p->>'subtotal')::numeric,
    (p->>'delivery_fee')::numeric,
    coalesce((p->>'discount')::numeric, 0),
    (p->>'total')::numeric,
    coalesce((p->>'amount_paid')::numeric, 0),
    coalesce((p->>'has_pre_order')::boolean, false),
    nullif(p->>'customer_note', '')
  )
  returning * into v_order;

  for v_line in select value from jsonb_array_elements(p->'lines') loop
    insert into storefront_order_items (
      order_id, product_id, sku, name, qty, unit_price, is_pre_order
    ) values (
      v_order.id,
      (v_line->>'product_id')::uuid,
      v_line->>'sku',
      v_line->>'name',
      (v_line->>'qty')::integer,
      (v_line->>'unit_price')::numeric,
      coalesce((v_line->>'is_pre_order')::boolean, false)
    );
  end loop;

  -- An empty `lines` array would otherwise produce exactly the orphan row this
  -- function exists to prevent.
  if not exists (select 1 from storefront_order_items where order_id = v_order.id) then
    raise exception 'order % has no lines', v_order.reference;
  end if;

  insert into storefront_order_events (order_id, kind, detail)
  values (v_order.id, 'placed', jsonb_build_object('source', 'storefront'));

  -- ---- the pre-order half, when there is one -------------------------
  select coalesce(sum(oi.qty * oi.unit_price), 0) into v_pre_total
  from storefront_order_items oi
  where oi.order_id = v_order.id and oi.is_pre_order;

  if v_pre_total > 0 then
    insert into pre_orders (
      customer_name, customer_phone, customer_address,
      total_amount, amount_paid, order_date, status, note,
      storefront_order_id
    ) values (
      v_order.customer_name,
      v_order.customer_phone,
      concat_ws(', ',
        v_order.address_line,
        nullif(v_order.landmark, ''),
        nullif(v_order.area, ''),
        v_order.district,
        v_order.division),
      v_pre_total,
      -- Never more than the pre-order's own total: a mixed basket's
      -- amount_paid may cover the in-stock part too, and pre_orders has a
      -- CHECK that paid <= total which would abort the customer's order.
      least(v_order.amount_paid, v_pre_total),
      current_date,
      'pending',
      concat('From website order ', v_order.reference),
      v_order.id
    )
    returning pre_orders.id into v_pre_id;

    insert into pre_order_items (pre_order_id, product_id, item_note, qty, unit_price)
    select v_pre_id, oi.product_id, oi.name, oi.qty, oi.unit_price
    from storefront_order_items oi
    where oi.order_id = v_order.id and oi.is_pre_order;
  end if;

  return query
  select v_order.id, v_order.reference, v_order.public_token;
end;
$$;

-- ================================================================
-- 3. Reserved stock, without double counting
--
-- 1005 taught v_reserved_stock about open website orders. Now a website
-- pre-order ALSO creates pre_order_items, so a pre-order line would be
-- counted on both sides of the union and reserve twice as much as exists.
--
-- The split is by line, not by order: the website side counts only its
-- in-stock lines, the pre-order side counts the rest. A mixed basket
-- therefore reserves each line exactly once, from whichever side owns it.
-- ================================================================

create or replace view v_reserved_stock with (security_invoker = on) as
select product_id, sum(reserved)::int as reserved
from (
  -- pre-orders, from the ERP or the website
  select i.product_id, sum(i.qty)::int as reserved
  from pre_order_items i
  join pre_orders po on po.id = i.pre_order_id
  where i.product_id is not null
    and po.status in ('pending','confirmed')
    and po.converted_sale_id is null
  group by i.product_id

  union all

  -- website orders, IN-STOCK lines only; the pre-order lines are counted
  -- above, through the pre_orders row this order created
  select oi.product_id, sum(oi.qty)::int as reserved
  from storefront_order_items oi
  join storefront_orders o on o.id = oi.order_id
  where oi.product_id is not null
    and not oi.is_pre_order
    and o.status in ('placed','confirmed','packed','handed_to_courier')
  group by oi.product_id
) both_sources
group by product_id;

grant select on v_reserved_stock to authenticated;

-- ================================================================
-- 4. A delivered website order becomes an ERP sale
--
-- This is the step that makes the profit reports true. Explicit and
-- admin-only, for the reason at the top of the file.
--
-- What it does NOT do is invent numbers. delivery_cost — what was actually
-- paid to the courier — is not knowable here, so it is left 0 for the owner
-- to fill in on the sale. A guessed cost would silently corrupt margin, which
-- is the one number this ERP exists to compute.
-- ================================================================

create or replace function convert_storefront_order_to_sale(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    storefront_orders;
  v_sale_id  uuid;
  v_existing uuid;
  v_lines    integer;
begin
  perform require_erp_admin();

  -- Lock it: two taps on a slow phone connection are the realistic way this
  -- gets called twice, and the unique constraint alone would raise an ugly
  -- error rather than a clear one.
  select * into v_order from storefront_orders where id = p_order_id for update;
  if not found then
    raise exception 'no such order';
  end if;

  select id into v_existing from sales where storefront_order_id = p_order_id;
  if v_existing is not null then
    raise exception 'order % is already recorded as a sale', v_order.reference
      using errcode = '23505';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'order % is %, not delivered — record the sale once the parcel has arrived and the cash is in',
      v_order.reference, v_order.status;
  end if;

  -- Every website line carries a product_id. If one does not, the basket
  -- referenced something that has since been deleted, and guessing which
  -- product it was would put a wrong cost into the margin.
  if exists (
    select 1 from storefront_order_items
    where order_id = p_order_id and product_id is null
  ) then
    raise exception 'order % has a line with no product; fix it before recording the sale',
      v_order.reference;
  end if;

  insert into sales (
    sale_date, channel, customer_name, customer_phone, customer_address,
    discount, delivery_charge, delivery_cost, status, note, storefront_order_id
  ) values (
    current_date,
    -- No 'website' value exists on sales_channel and extending an enum from a
    -- migration that also uses the new value is fragile. The link column is a
    -- stronger signal anyway: website sales are exactly those with a non-null
    -- storefront_order_id.
    'other',
    v_order.customer_name,
    v_order.customer_phone,
    concat_ws(', ',
      v_order.address_line,
      nullif(v_order.landmark, ''),
      nullif(v_order.area, ''),
      v_order.district,
      v_order.division),
    v_order.discount,
    v_order.delivery_fee,
    0,                       -- what the courier charged: only the owner knows
    'confirmed',
    concat('Website order ', v_order.reference),
    v_order.id
  )
  returning sales.id into v_sale_id;

  insert into sale_items (sale_id, product_id, qty, unit_price)
  select v_sale_id, oi.product_id, oi.qty, oi.unit_price
  from storefront_order_items oi
  where oi.order_id = p_order_id;

  select count(*) into v_lines from sale_items where sale_id = v_sale_id;
  if v_lines = 0 then
    raise exception 'order % produced no sale lines', v_order.reference;
  end if;

  -- Moves the stock and snapshots unit_cost. post_sale is itself admin-only
  -- now; the guard reads the caller's JWT, so an admin calling through here
  -- passes it.
  perform post_sale(v_sale_id);

  -- A pre-order that has been delivered is fulfilled, and must stop reserving
  -- stock that has now physically left.
  update pre_orders
     set status = 'fulfilled',
         converted_sale_id = v_sale_id,
         updated_at = now()
   where storefront_order_id = p_order_id
     and converted_sale_id is null;

  insert into storefront_order_events (order_id, kind, detail)
  values (p_order_id, 'note',
          jsonb_build_object('note', concat('Recorded as sale ', v_sale_id)));

  return v_sale_id;
end;
$$;

revoke all on function convert_storefront_order_to_sale(uuid) from public;
revoke all on function convert_storefront_order_to_sale(uuid) from anon;
grant execute on function convert_storefront_order_to_sale(uuid) to authenticated;
