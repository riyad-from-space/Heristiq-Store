-- Unposted sales must not count as revenue or profit.
--
-- A sale is written in two steps: the row and its lines are inserted, then
-- post_sale() snapshots cost onto each line and writes the stock ledger. If the
-- process dies between those steps the sale survives with posted = false and
-- every sale_items.unit_cost still at its 0 default.
--
-- v_daily_sales filtered on status but not on posted, so such a sale counted as
-- full revenue against zero cost — it reported as pure profit. v_product_performance
-- already required s.posted; this brings the daily view in line with it.

create or replace view v_daily_sales with (security_invoker = on) as
select
  sale_date,
  count(*)                          as orders,
  sum(units)                        as units,
  sum(product_revenue)              as revenue,
  sum(cogs)                         as cogs,
  sum(gross_profit)                 as gross_profit,
  round(avg(product_revenue), 2)    as avg_order_value
from v_sale_profit
where posted
  and status not in ('cancelled','returned')
group by sale_date;
