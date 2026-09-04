-- Let the unit cost be corrected by hand, without losing why.
--
-- avg_cost is derived from the purchase ledger, so there is no field to edit.
-- But real corrections happen: a purchase entered at the wrong price, a supplier
-- credit, stock revalued after damage. Overwriting the number silently would
-- leave the cache disagreeing with the ledger and no record of who changed what.
--
-- Instead every manual change is a row in cost_revaluations. The ledger still
-- records what each shipment actually cost; this records the corrections on top.

create table cost_revaluations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null default '00000000-0000-0000-0000-000000000001',
  product_id   uuid not null references products(id) on delete cascade,
  old_cost     numeric(14,4) not null,
  new_cost     numeric(14,4) not null check (new_cost >= 0),
  on_hand      integer not null,      -- stock level when the change was made
  note         text,
  created_at   timestamptz not null default now()
);

create index cost_revaluations_product_idx on cost_revaluations(product_id, created_at desc);

alter table cost_revaluations enable row level security;

create policy cost_revaluations_authenticated_all on public.cost_revaluations
  for all to authenticated using (true) with check (true);

-- Sets a new unit cost and records the change. No-ops if the cost is unchanged.
create or replace function revalue_product_cost(
  p_product_id uuid,
  p_new_cost   numeric,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_cost    numeric(14,4);
  cur_on_hand integer;
begin
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
$$;

grant execute on function revalue_product_cost(uuid, numeric, text) to authenticated;
