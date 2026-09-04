-- Pre-orders: something a customer has committed to that is not yet a sale.
--
-- Deliberately NOT a sale and NOT a stock movement. A pre-order is a promise; the
-- ledger only records goods that actually moved. Nothing here touches product_stock,
-- so the stock numbers stay exactly as trustworthy as before. When a pre-order is
-- fulfilled you record the sale on the Sales page, which is what moves the stock.
--
-- Payment status is DERIVED from amount_paid against total_amount rather than stored,
-- so the two can never disagree — the same reasoning that keeps stock derived from
-- the ledger.

create type pre_order_status as enum ('pending','confirmed','fulfilled','cancelled');

create table pre_orders (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default '00000000-0000-0000-0000-000000000001',

  customer_name  text not null check (length(trim(customer_name)) > 0),
  customer_phone text not null check (length(trim(customer_phone)) > 0),

  product_id     uuid references products(id) on delete restrict,
  item_note      text,          -- for something not in the catalogue yet
  qty            integer not null default 1 check (qty > 0),

  total_amount   numeric(12,2) not null default 0 check (total_amount >= 0),
  amount_paid    numeric(12,2) not null default 0 check (amount_paid  >= 0),

  order_date     date not null default current_date,
  expected_date  date,
  status         pre_order_status not null default 'pending',
  note           text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Overpayment is a data-entry slip, not a state worth modelling.
  constraint pre_orders_paid_within_total check (amount_paid <= total_amount),
  -- Either a catalogue product or a free-text description, but not neither.
  constraint pre_orders_has_item check (product_id is not null or nullif(trim(coalesce(item_note,'')), '') is not null)
);

create index pre_orders_status_idx  on pre_orders(status, order_date desc);
create index pre_orders_product_idx on pre_orders(product_id);
create index pre_orders_date_idx    on pre_orders(order_date desc);

-- B4, applied here where it is cheap: record when a row was last touched.
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pre_orders_touch before update on pre_orders
for each row execute function touch_updated_at();

alter table pre_orders enable row level security;

create policy pre_orders_authenticated_all on public.pre_orders
  for all to authenticated using (true) with check (true);

-- Payment status derived, never stored, so it cannot drift from the amounts.
create view v_pre_orders with (security_invoker = on) as
select
  po.id,
  po.customer_name,
  po.customer_phone,
  po.product_id,
  p.name as product_name,
  p.sku  as product_sku,
  po.item_note,
  po.qty,
  po.total_amount,
  po.amount_paid,
  round(po.total_amount - po.amount_paid, 2) as amount_due,
  case
    when po.total_amount = 0 then 'unpaid'
    when po.amount_paid >= po.total_amount then 'paid'
    when po.amount_paid > 0 then 'partial'
    else 'unpaid'
  end as payment_status,
  po.order_date,
  po.expected_date,
  po.status,
  po.note,
  po.created_at,
  po.updated_at
from pre_orders po
left join products p on p.id = po.product_id;

grant select on v_pre_orders to authenticated;
