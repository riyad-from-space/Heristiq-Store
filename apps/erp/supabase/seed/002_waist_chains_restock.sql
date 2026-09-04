-- Seed: second waist chain purchase — 5 products, 58 units, ৳4,419.
--
-- Same products as 001, bought again at different prices.
--
-- VALUATION POLICY — a deliberate departure from the schema default.
--   The trigger costs stock at a moving weighted average, so these lines would
--   normally blend old and new (WC-002 -> ৳73.38). By explicit instruction the
--   cost is instead OVERWRITTEN with the newest purchase price (WC-002 -> ৳73),
--   so every unit on hand carries what the most recent shipment cost.
--
--   The ledger is untouched and still records what each shipment actually cost:
--   2 @ ৳79 then 30 @ ৳73. Only product_stock.avg_cost — the derived cache — is
--   overwritten. Rebuilding that cache by replaying stock_movements would restore
--   the weighted average and undo this.
--
--   Effect here: stock value ৳5,436 instead of ৳5,496. The ৳60 difference is
--   real money paid for older units that COGS will no longer recover.
--
-- WC-001 and WC-003 are not in this shipment and keep their existing cost.
-- No supplier and no freight/import, so landed cost equals supplier price.
--
-- Requires 001_waist_chains.sql first. Safe to run once.

begin;

do $$
declare
  pid uuid;
  n   int;
begin
  insert into purchases (purchase_date, note)
  values (current_date, 'Waist chain restock — 58 units, seeded from price list')
  returning id into pid;

  insert into purchase_items (purchase_id, product_id, qty, unit_cost)
  select pid, p.id, v.qty, v.unit_cost
  from (values
    ('WC-005',  5,  52.00),   -- Silver moon
    ('WC-002', 30,  73.00),   -- Gold large and small oval
    ('WC-004',  3,  58.00),   -- Gold long oval
    ('WC-006', 15,  80.00),   -- Golden starfish
    ('WC-007',  5, 119.00)    -- Golden shell conch
  ) as v(sku, qty, unit_cost)
  join products p on p.sku = v.sku;

  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'expected 5 lines, matched % — run 001_waist_chains.sql first', n;
  end if;

  -- Writes the ledger and blends the weighted average.
  perform post_purchase(pid);

  -- Then overwrite the blend with this shipment's price, per the policy above.
  update product_stock ps
     set avg_cost = pi.unit_landed_cost
    from purchase_items pi
   where pi.purchase_id = pid
     and ps.product_id  = pi.product_id;
end $$;

commit;
