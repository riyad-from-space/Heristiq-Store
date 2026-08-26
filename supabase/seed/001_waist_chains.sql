-- Seed: waist chain purchase — 7 products, 15 units, ৳1,077.
--
-- Selling prices are left at 0 deliberately; set them on the Products page.
-- Until you do, margin and profit will read as a loss, which is correct — the
-- app cannot know what you sell these for.
--
-- No supplier and no freight/import costs, so landed cost equals supplier price.
--
-- Safe to run once. Re-running creates a SECOND purchase and doubles the stock;
-- the products themselves are guarded by the unique (org_id, sku) constraint.

begin;

-- ---------------------------------------------------------------- products
insert into products (sku, name, selling_price, reorder_level) values
  ('WC-001', 'Large and small oval waist chain',      0, 3),
  ('WC-002', 'Gold large and small oval waist chain', 0, 3),
  ('WC-003', 'Long oval waist chain',                 0, 3),
  ('WC-004', 'Gold long oval waist chain',            0, 3),
  ('WC-005', 'Silver moon waist chain',               0, 3),
  ('WC-006', 'Golden starfish waist chain',           0, 3),
  ('WC-007', 'Golden shell conch waist chain',        0, 3)
on conflict (org_id, sku) do nothing;

-- ---------------------------------------------------------------- purchase
do $$
declare
  pid uuid;
begin
  insert into purchases (purchase_date, note)
  values (current_date, 'Waist chain purchase — 15 units, seeded from price list')
  returning id into pid;

  insert into purchase_items (purchase_id, product_id, qty, unit_cost)
  select pid, p.id, v.qty, v.unit_cost
  from (values
    ('WC-001', 2,  72.00),
    ('WC-002', 2,  79.00),
    ('WC-003', 2,  56.00),
    ('WC-004', 4,  63.00),
    ('WC-005', 2,  56.00),
    ('WC-006', 2,  86.00),
    ('WC-007', 1, 127.00)
  ) as v(sku, qty, unit_cost)
  join products p on p.sku = v.sku;

  -- Allocates extras (none here) and writes the stock ledger. This is what puts stock in.
  perform post_purchase(pid);
end $$;

commit;
