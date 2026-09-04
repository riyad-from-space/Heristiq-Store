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
