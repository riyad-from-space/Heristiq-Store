-- D2: per-product profit ignored the sale-level discount.
--
-- profit_30d was sum((unit_price - unit_cost) * qty), which is gross of any discount
-- given on the sale. A product sold at 200 with a 50 discount on the order reported
-- the full 200 of revenue, so best-sellers looked more profitable than they were.
--
-- The discount now gets allocated across the lines by value — the same rule
-- post_purchase() uses for freight — so each product carries its share.
--
-- Delivery is deliberately NOT allocated. It is a per-order cost, not product margin,
-- and v_sale_profit already reports it separately as net_delivery.
--
-- B3 is fixed in the same spirit: the posted/status filter moves into a CTE so it is
-- applied once, at the right grain, instead of riding on a LEFT JOIN condition.

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
  coalesce(sum(sl.qty) filter (where sl.sale_date >= current_date - 30), 0) as units_30d,
  coalesce(sum(sl.qty) filter (where sl.sale_date >= current_date - 90), 0) as units_90d,
  round(coalesce(sum(sl.qty * (sl.unit_price - sl.unit_cost) - sl.allocated_discount)
        filter (where sl.sale_date >= current_date - 30), 0), 2) as profit_30d,
  max(sl.sale_date) as last_sold_on,
  round(coalesce(sum(sl.qty) filter (where sl.sale_date >= current_date - 30), 0) / 30.0, 2)
    as avg_daily_units_30d,
  case
    when coalesce(sum(sl.qty) filter (where sl.sale_date >= current_date - 30), 0) > 0
    then round(coalesce(ps.on_hand, 0) /
         (coalesce(sum(sl.qty) filter (where sl.sale_date >= current_date - 30), 0) / 30.0), 1)
  end as days_of_stock_left
from products p
left join product_stock ps on ps.product_id = p.id
left join sale_lines  sl on sl.product_id = p.id
where p.is_active
group by p.id, p.sku, p.name, ps.on_hand;
