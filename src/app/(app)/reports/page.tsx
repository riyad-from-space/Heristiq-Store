import { createClient } from "@/lib/supabase/server";
import { date, daysAgoDhaka, money, num } from "@/lib/format";
import { Card, Empty, Stat, Table, Td } from "@/components/ui";
import type { ProductPerformanceRow, ProductStockRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type DailyRow = {
  sale_date: string;
  orders: number;
  units: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  avg_order_value: number;
};

type SlowRow = ProductPerformanceRow & { tied_up_value: number };

export default async function ReportsPage() {
  const supabase = await createClient();

  // Filter by date, not by row count — .limit(30) returned the last 30 days that
  // HAD sales, so a quiet fortnight silently pulled in older days.
  const since = daysAgoDhaka(30);

  const [dailyRes, perfRes, slowRes, lowRes] = await Promise.all([
    supabase
      .from("v_daily_sales")
      .select("*")
      .gte("sale_date", since)
      .order("sale_date", { ascending: false }),
    supabase
      .from("v_product_performance")
      .select("*")
      .order("units_30d", { ascending: false })
      .limit(10),
    supabase.from("v_slow_moving").select("*").limit(15),
    supabase.from("v_low_stock").select("*"),
  ]);

  const daily = (dailyRes.data ?? []) as DailyRow[];
  const perf = (perfRes.data ?? []) as ProductPerformanceRow[];
  const slow = (slowRes.data ?? []) as SlowRow[];
  const low = (lowRes.data ?? []) as ProductStockRow[];

  const revenue30 = daily.reduce((s, d) => s + Number(d.revenue), 0);
  const profit30 = daily.reduce((s, d) => s + Number(d.gross_profit), 0);
  const orders30 = daily.reduce((s, d) => s + Number(d.orders), 0);
  const tiedUp = slow.reduce((s, r) => s + Number(r.tied_up_value), 0);

  return (
    <>
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="-mt-3 text-sm text-neutral-500">
        Figures cover the last 30 days of recorded sales. Cancelled and returned
        orders are excluded.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={money(revenue30)} hint="last 30 days" />
        <Stat
          label="Gross profit"
          value={money(profit30)}
          hint={revenue30 > 0 ? `${num((profit30 / revenue30) * 100, 1)}% margin` : "—"}
          tone={profit30 >= 0 ? "good" : "bad"}
        />
        <Stat
          label="Average order value"
          value={money(orders30 > 0 ? revenue30 / orders30 : 0)}
          hint={`${orders30} orders`}
        />
        <Stat
          label="Cash stuck in slow stock"
          value={money(tiedUp)}
          hint={`${slow.length} products, no sale in 30 days`}
          tone={tiedUp > 0 ? "warn" : "neutral"}
        />
      </div>

      <Card title="Best sellers — last 30 days">
        {perf.length === 0 || perf.every((p) => p.units_30d === 0) ? (
          <Empty>No sales in the last 30 days.</Empty>
        ) : (
          <Table
            head={["Product", "Units 30d", "Profit 30d", "On hand", "Sells/day", "Stock lasts"]}
          >
            {perf
              .filter((p) => p.units_30d > 0)
              .map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">
                    {p.name}
                    <span className="ml-2 text-xs text-neutral-500">{p.sku}</span>
                  </Td>
                  <Td className="tabular-nums">{p.units_30d}</Td>
                  <Td className="tabular-nums">{money(p.profit_30d)}</Td>
                  <Td className="tabular-nums">{p.on_hand}</Td>
                  <Td className="tabular-nums text-neutral-500">
                    {num(p.avg_daily_units_30d, 2)}
                  </Td>
                  <Td
                    className={`tabular-nums ${
                      p.days_of_stock_left !== null && p.days_of_stock_left < 7
                        ? "font-semibold text-amber-600 dark:text-amber-400"
                        : ""
                    }`}
                  >
                    {p.days_of_stock_left === null
                      ? "—"
                      : `${num(p.days_of_stock_left, 1)} days`}
                  </Td>
                </tr>
              ))}
          </Table>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Needs restocking (${low.length})`}>
          {low.length === 0 ? (
            <Empty>Nothing below its reorder level.</Empty>
          ) : (
            <Table head={["Product", "On hand", "Reorder at"]}>
              {low.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td
                    className={`tabular-nums ${
                      p.on_hand <= 0 ? "font-semibold text-red-600 dark:text-red-400" : ""
                    }`}
                  >
                    {p.on_hand}
                  </Td>
                  <Td className="tabular-nums text-neutral-500">{p.reorder_level}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title={`Slow moving (${slow.length})`}>
          {slow.length === 0 ? (
            <Empty>Everything in stock has sold in the last 30 days.</Empty>
          ) : (
            <Table head={["Product", "On hand", "Value stuck", "Last sold"]}>
              {slow.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="tabular-nums">{p.on_hand}</Td>
                  <Td className="tabular-nums">{money(p.tied_up_value)}</Td>
                  <Td className="text-neutral-500">
                    {p.last_sold_on ? date(p.last_sold_on) : "never"}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title="Daily sales">
        {daily.length === 0 ? (
          <Empty>No sales recorded yet.</Empty>
        ) : (
          <Table
            head={["Date", "Orders", "Units", "Revenue", "Cost", "Profit", "Avg order"]}
          >
            {daily.map((d) => (
              <tr key={d.sale_date}>
                <Td className="whitespace-nowrap">{date(d.sale_date)}</Td>
                <Td className="tabular-nums">{d.orders}</Td>
                <Td className="tabular-nums">{d.units}</Td>
                <Td className="tabular-nums">{money(d.revenue)}</Td>
                <Td className="tabular-nums text-neutral-500">{money(d.cogs)}</Td>
                <Td
                  className={`tabular-nums font-medium ${
                    Number(d.gross_profit) < 0 ? "text-red-600 dark:text-red-400" : ""
                  }`}
                >
                  {money(d.gross_profit)}
                </Td>
                <Td className="tabular-nums text-neutral-500">
                  {money(d.avg_order_value)}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
