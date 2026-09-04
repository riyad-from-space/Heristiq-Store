-- D1: one line per product on a sale.
--
-- Nothing stopped the same product appearing on two lines of one sale. update_sale()
-- then does `select qty into old_qty ... where sale_id = ? and product_id = ?`, which
-- silently takes the FIRST of the two rows, while the UPDATE that follows hits BOTH.
--
-- Demonstrated on Postgres 17: a sale with 2 + 3 units of one product, edited to 4,
-- became 8 units across 2 lines. Stock went to -5 instead of -4 and the sale reported
-- 1,600.00 of revenue instead of 800.00.
--
-- Existing duplicates are merged first, then the constraint makes it unreachable.
-- Merging sums the quantity and takes the value-weighted average of price and cost,
-- so the sale's revenue and COGS totals are unchanged by the merge itself.

do $$
declare
  merged int := 0;
begin
  with dupes as (
    select sale_id, product_id,
           sum(qty)                                        as total_qty,
           sum(qty * unit_price) / nullif(sum(qty), 0)     as wavg_price,
           sum(qty * unit_cost)  / nullif(sum(qty), 0)     as wavg_cost,
           (array_agg(id order by id))[1]                   as keep_id
    from sale_items
    group by sale_id, product_id
    having count(*) > 1
  ), updated as (
    update sale_items si
       set qty        = d.total_qty,
           unit_price = round(d.wavg_price, 2),
           unit_cost  = round(d.wavg_cost, 4)
      from dupes d
     where si.id = d.keep_id
     returning si.id
  ), removed as (
    delete from sale_items si
     using dupes d
     where si.sale_id = d.sale_id
       and si.product_id = d.product_id
       and si.id <> d.keep_id
     returning si.id
  )
  select count(*) into merged from removed;

  if merged > 0 then
    raise notice 'merged % duplicate sale line(s) before adding the constraint', merged;
  end if;
end $$;

alter table sale_items
  add constraint sale_items_one_line_per_product unique (sale_id, product_id);

-- Same reasoning for purchases. post_purchase() tolerates duplicates today because it
-- iterates every row, but the ledger reads more truthfully with one line per product,
-- and it keeps the two tables consistent.
do $$
declare
  merged int := 0;
begin
  with dupes as (
    select purchase_id, product_id,
           sum(qty)                                    as total_qty,
           sum(qty * unit_cost) / nullif(sum(qty), 0)  as wavg_cost,
           (array_agg(id order by id))[1]               as keep_id
    from purchase_items
    group by purchase_id, product_id
    having count(*) > 1
  ), updated as (
    update purchase_items pi
       set qty = d.total_qty, unit_cost = round(d.wavg_cost, 2)
      from dupes d
     where pi.id = d.keep_id
     returning pi.id
  ), removed as (
    delete from purchase_items pi
     using dupes d
     where pi.purchase_id = d.purchase_id
       and pi.product_id = d.product_id
       and pi.id <> d.keep_id
     returning pi.id
  )
  select count(*) into merged from removed;

  if merged > 0 then
    raise notice 'merged % duplicate purchase line(s)', merged;
  end if;
end $$;

alter table purchase_items
  add constraint purchase_items_one_line_per_product unique (purchase_id, product_id);

-- Supports update_sale's per-product lookup, which was doing a scan of the sale's lines.
create index if not exists sale_items_sale_product_idx on sale_items(sale_id, product_id);
