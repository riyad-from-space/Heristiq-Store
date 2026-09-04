-- LOW: the "last 30 days" window spans 31 dates.
--
-- `sale_date >= current_date - 30` includes both endpoints, so the filter covers
-- 31 calendar days while avg_daily_units_30d divides by 30 — a ~3% overstatement
-- of the daily rate, which then feeds days_of_stock_left. Narrow the window to
-- the 30 days it claims rather than changing the divisor, so the label, the
-- filter and the arithmetic all agree.
--
-- current_date is the DATABASE's day (UTC on Supabase), not Dhaka's. Between
-- midnight and 06:00 Dhaka they differ, so a window can lag the business day by
-- one. Left alone deliberately: correcting it means passing the business date in
-- from the app, and a one-day edge on a 30-day trend is not worth that coupling.

create or replace view v_product_performance with (security_invoker = on) as
with sale_lines as (
  select
    si.product_id,
    si.qty,
    si.unit_price,
    si.unit_cost,
    s.sale_date,
    case
      when sum(si.qty * si.unit_price) over (partition by si.sale_id) > 0
      then s.discount * ((si.qty * si.unit_price)
                         / sum(si.qty * si.unit_price) over (partition by si.sale_id))
      else 0
    end as allocated_discount
  from sale_items si
  join sales s on s.id = si.sale_id
  where s.posted
    and s.status not in ('cancelled','returned')
)
select
  p.id, p.sku, p.name,
  coalesce(ps.on_hand, 0) as on_hand,
  coalesce(sum(sl.qty) filter (where sl.sale_date > current_date - 30), 0) as units_30d,
  coalesce(sum(sl.qty) filter (where sl.sale_date > current_date - 90), 0) as units_90d,
  round(coalesce(sum(sl.qty * (sl.unit_price - sl.unit_cost) - sl.allocated_discount)
        filter (where sl.sale_date > current_date - 30), 0), 2) as profit_30d,
  max(sl.sale_date) as last_sold_on,
  round(coalesce(sum(sl.qty) filter (where sl.sale_date > current_date - 30), 0) / 30.0, 2)
    as avg_daily_units_30d,
  case
    when coalesce(sum(sl.qty) filter (where sl.sale_date > current_date - 30), 0) > 0
    then round(coalesce(ps.on_hand, 0) /
         (coalesce(sum(sl.qty) filter (where sl.sale_date > current_date - 30), 0) / 30.0), 1)
  end as days_of_stock_left
from products p
left join product_stock ps on ps.product_id = p.id
left join sale_lines  sl on sl.product_id = p.id
where p.is_active
group by p.id, p.sku, p.name, ps.on_hand;
