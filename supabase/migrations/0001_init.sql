-- Heristiq ERP — Phase 1 schema (inventory + simple sales/profit calculation)
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- Design notes:
--  * Stock is NEVER stored as a directly-editable number. Every change is a row in
--    stock_movements; product_stock is a trigger-maintained cache derived from it.
--  * Costing is moving weighted average. Landed cost (freight/import/other) is
--    allocated across purchase lines by value at post time.
--  * org_id exists on every business table so multi-tenancy is a config change later,
--    not a migration. Phase 1 uses a single fixed org.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums

create type movement_type  as enum ('purchase_in','sale_out','return_in','damage_out','adjustment');
create type sale_status    as enum ('pending','confirmed','delivered','cancelled','returned');
create type sales_channel  as enum ('facebook','instagram','tiktok','messenger','whatsapp','stall','other');

-- ---------------------------------------------------------------- masters

create table categories (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  name       text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table suppliers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  name       text not null,
  phone      text,
  address    text,
  note       text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default '00000000-0000-0000-0000-000000000001',
  sku           text not null,
  name          text not null,
  category_id   uuid references categories(id) on delete set null,
  supplier_id   uuid references suppliers(id) on delete set null,
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  reorder_level integer not null default 3 check (reorder_level >= 0),
  image_url     text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (org_id, sku)
);

create index products_category_idx on products(category_id);
create index products_supplier_idx on products(supplier_id);

-- Derived cache. Only the stock_movements trigger writes here.
create table product_stock (
  product_id       uuid primary key references products(id) on delete cascade,
  on_hand          integer not null default 0,
  avg_cost         numeric(14,4) not null default 0,
  last_movement_at timestamptz
);

-- ---------------------------------------------------------------- purchases

create table purchases (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default '00000000-0000-0000-0000-000000000001',
  supplier_id   uuid references suppliers(id) on delete set null,
  purchase_date date not null default current_date,
  freight_cost  numeric(12,2) not null default 0 check (freight_cost >= 0),
  import_cost   numeric(12,2) not null default 0 check (import_cost  >= 0),
  other_cost    numeric(12,2) not null default 0 check (other_cost   >= 0),
  note          text,
  posted        boolean not null default false,
  posted_at     timestamptz,
  created_at    timestamptz not null default now()
);

create table purchase_items (
  id               uuid primary key default gen_random_uuid(),
  purchase_id      uuid not null references purchases(id) on delete cascade,
  product_id       uuid not null references products(id) on delete restrict,
  qty              integer not null check (qty > 0),
  unit_cost        numeric(12,2) not null check (unit_cost >= 0),
  allocated_extra  numeric(14,4) not null default 0,  -- this line's share of freight+import+other
  unit_landed_cost numeric(14,4) not null default 0   -- unit_cost + allocated_extra/qty
);

create index purchase_items_purchase_idx on purchase_items(purchase_id);
create index purchase_items_product_idx  on purchase_items(product_id);

-- ---------------------------------------------------------------- sales

create table sales (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null default '00000000-0000-0000-0000-000000000001',
  sale_date        date not null default current_date,
  channel          sales_channel not null default 'other',
  customer_name    text,
  customer_phone   text,
  customer_address text,
  discount         numeric(12,2) not null default 0 check (discount >= 0),
  delivery_charge  numeric(12,2) not null default 0 check (delivery_charge >= 0), -- collected FROM customer
  delivery_cost    numeric(12,2) not null default 0 check (delivery_cost   >= 0), -- paid TO courier
  status           sale_status not null default 'confirmed',
  note             text,
  posted           boolean not null default false,
  posted_at        timestamptz,
  created_at       timestamptz not null default now()
);

create index sales_date_idx on sales(sale_date);

create table sale_items (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  qty        integer not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost  numeric(14,4) not null default 0   -- snapshot of avg_cost at post time
);

create index sale_items_sale_idx    on sale_items(sale_id);
create index sale_items_product_idx on sale_items(product_id);

-- ---------------------------------------------------------------- stock ledger

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default '00000000-0000-0000-0000-000000000001',
  product_id      uuid not null references products(id) on delete restrict,
  type            movement_type not null,
  qty_delta       integer not null check (qty_delta <> 0),  -- positive = in, negative = out
  unit_cost       numeric(14,4) not null default 0,
  reference_table text,
  reference_id    uuid,
  note            text,
  created_at      timestamptz not null default now()
);

create index stock_movements_product_idx on stock_movements(product_id, created_at desc);
create index stock_movements_ref_idx     on stock_movements(reference_table, reference_id);

-- ================================================================
-- Moving weighted-average costing, maintained from the ledger
-- ================================================================

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
    -- Stock coming in re-averages the cost. If we were at or below zero there is
    -- no meaningful prior average to blend, so the incoming cost becomes the average.
    if cur_on_hand <= 0 then
      new_avg := new.unit_cost;
    else
      new_avg := (cur_on_hand * cur_avg + new.qty_delta * new.unit_cost) / new_on_hand;
    end if;
  else
    -- Stock going out is valued at the current average; the average itself is unchanged.
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

create trigger stock_movements_apply
after insert on stock_movements
for each row execute function apply_stock_movement();

-- Keep the ledger append-only. Corrections are new movements, not edits.
create or replace function stock_movements_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements is append-only — record a correcting movement instead';
end;
$$;

create trigger stock_movements_no_update before update or delete on stock_movements
for each row execute function stock_movements_immutable();

-- Every product gets a stock row up front so joins never miss.
create or replace function seed_product_stock()
returns trigger language plpgsql as $$
begin
  insert into product_stock (product_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger products_seed_stock after insert on products
for each row execute function seed_product_stock();

-- ================================================================
-- Posting functions
-- ================================================================

-- Allocates freight/import/other across lines by line value, then writes the ledger.
create or replace function post_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p           purchases%rowtype;
  total_value numeric(14,4);
  extra       numeric(14,4);
  item        record;
  share       numeric(14,4);
  landed      numeric(14,4);
begin
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
$$;

-- Snapshots current average cost onto each line, then writes the ledger.
create or replace function post_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s    sales%rowtype;
  item record;
  cost numeric(14,4);
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'sale % not found', p_sale_id; end if;
  if s.posted then raise exception 'sale % is already posted', p_sale_id; end if;

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

-- Reverses a posted sale (cancellation / return): stock back in at the cost it left at.
create or replace function void_sale(p_sale_id uuid, p_status sale_status default 'cancelled')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s    sales%rowtype;
  item record;
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'sale % not found', p_sale_id; end if;
  if not s.posted then
    update sales set status = p_status where id = p_sale_id;
    return;
  end if;
  if s.status in ('cancelled','returned') then
    raise exception 'sale % is already %', p_sale_id, s.status;
  end if;

  for item in select * from sale_items where sale_id = p_sale_id loop
    insert into stock_movements (product_id, type, qty_delta, unit_cost, reference_table, reference_id, note)
    values (item.product_id, 'return_in', item.qty, item.unit_cost, 'sales', p_sale_id, 'sale ' || p_status::text);
  end loop;

  update sales set status = p_status where id = p_sale_id;
end;
$$;

-- Manual correction: stock count fix, damage, or write-off.
create or replace function adjust_stock(
  p_product_id uuid,
  p_qty_delta  int,
  p_unit_cost  numeric default null,
  p_note       text default null,
  p_damage     boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cost numeric(14,4);
begin
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
$$;

-- ================================================================
-- Reporting views  (all the "simple calculation" lives here, not in the app)
-- ================================================================

create view v_product_stock with (security_invoker = on) as
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
  ps.last_movement_at
from products p
left join product_stock ps on ps.product_id = p.id
left join categories    c  on c.id = p.category_id
left join suppliers     s  on s.id = p.supplier_id;

create view v_low_stock with (security_invoker = on) as
select * from v_product_stock
where is_active and on_hand <= reorder_level
order by on_hand asc, name asc;

-- Per-sale P&L.
--   product_revenue = what the customer paid for goods, after discount
--   net_delivery    = delivery collected minus courier paid (negative on free delivery)
--   gross_profit    = product_revenue - cogs + net_delivery
create view v_sale_profit with (security_invoker = on) as
select
  s.id, s.sale_date, s.channel, s.status, s.posted,
  s.customer_name, s.customer_phone,
  coalesce(i.items_total, 0) as items_total,
  s.discount,
  round(coalesce(i.items_total, 0) - s.discount, 2) as product_revenue,
  round(coalesce(i.cogs, 0), 2)                     as cogs,
  s.delivery_charge,
  s.delivery_cost,
  round(s.delivery_charge - s.delivery_cost, 2)     as net_delivery,
  round(coalesce(i.items_total, 0) - s.discount - coalesce(i.cogs, 0)
        + s.delivery_charge - s.delivery_cost, 2)   as gross_profit,
  coalesce(i.units, 0) as units
from sales s
left join (
  select sale_id,
         sum(qty * unit_price) as items_total,
         sum(qty * unit_cost)  as cogs,
         sum(qty)              as units
  from sale_items group by sale_id
) i on i.sale_id = s.id;

create view v_daily_sales with (security_invoker = on) as
select
  sale_date,
  count(*)                          as orders,
  sum(units)                        as units,
  sum(product_revenue)              as revenue,
  sum(cogs)                         as cogs,
  sum(gross_profit)                 as gross_profit,
  round(avg(product_revenue), 2)    as avg_order_value
from v_sale_profit
where status not in ('cancelled','returned')
group by sale_date;

-- Units sold and profit per product, last 30 / 90 days.
create view v_product_performance with (security_invoker = on) as
select
  p.id, p.sku, p.name,
  coalesce(ps.on_hand, 0) as on_hand,
  coalesce(sum(si.qty) filter (where s.sale_date >= current_date - 30), 0) as units_30d,
  coalesce(sum(si.qty) filter (where s.sale_date >= current_date - 90), 0) as units_90d,
  round(coalesce(sum((si.unit_price - si.unit_cost) * si.qty)
        filter (where s.sale_date >= current_date - 30), 0), 2) as profit_30d,
  max(s.sale_date) as last_sold_on,
  round(coalesce(sum(si.qty) filter (where s.sale_date >= current_date - 30), 0) / 30.0, 2) as avg_daily_units_30d,
  case
    when coalesce(sum(si.qty) filter (where s.sale_date >= current_date - 30), 0) > 0
    then round(coalesce(ps.on_hand, 0) /
         (coalesce(sum(si.qty) filter (where s.sale_date >= current_date - 30), 0) / 30.0), 1)
  end as days_of_stock_left
from products p
left join product_stock ps on ps.product_id = p.id
left join sale_items si on si.product_id = p.id
left join sales s on s.id = si.sale_id and s.posted and s.status not in ('cancelled','returned')
where p.is_active
group by p.id, p.sku, p.name, ps.on_hand;

-- Sitting stock: has inventory, nothing sold in 30 days.
create view v_slow_moving with (security_invoker = on) as
select pp.*, round(pp.on_hand * coalesce(ps.avg_cost, 0), 2) as tied_up_value
from v_product_performance pp
join product_stock ps on ps.product_id = pp.id
where pp.on_hand > 0 and pp.units_30d = 0
order by tied_up_value desc;

-- ================================================================
-- Row Level Security
-- Phase 1: one business, one team — any signed-in user has full access.
-- The org_id columns are already in place for per-org policies later.
-- ================================================================

alter table categories      enable row level security;
alter table suppliers       enable row level security;
alter table products        enable row level security;
alter table product_stock   enable row level security;
alter table purchases       enable row level security;
alter table purchase_items  enable row level security;
alter table sales           enable row level security;
alter table sale_items      enable row level security;
alter table stock_movements enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'categories','suppliers','products','product_stock',
    'purchases','purchase_items','sales','sale_items','stock_movements'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

grant execute on function post_purchase(uuid)  to authenticated;
grant execute on function post_sale(uuid)      to authenticated;
grant execute on function void_sale(uuid, sale_status) to authenticated;
grant execute on function adjust_stock(uuid, int, numeric, text, boolean) to authenticated;
