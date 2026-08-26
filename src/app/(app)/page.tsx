import { createClient } from "@/lib/supabase/server";
import { money, num, todayDhaka } from "@/lib/format";
import { Card, Empty, LinkButton, Stat, Table, Td } from "@/components/ui";
import type { ProductStockRow, SaleProfitRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayDhaka();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [stockRes, lowRes, salesRes] = await Promise.all([
    supabase.from("v_product_stock").select("stock_value, on_hand, is_active"),
    supabase.from("v_low_stock").select("*").limit(6),
    supabase
      .from("v_sale_profit")
      .select("sale_date, product_revenue, cogs, gross_profit, status")
      .gte("sale_date", monthStart)
      .eq("posted", true)
      .not("status", "in", "(cancelled,returned)"),
  ]);

  const stock = (stockRes.data ?? []) as Pick<
    ProductStockRow,
    "stock_value" | "on_hand" | "is_active"
  >[];
  const low = (lowRes.data ?? []) as ProductStockRow[];
  const sales = (salesRes.data ?? []) as SaleProfitRow[];

  const stockValue = stock.reduce((s, r) => s + Number(r.stock_value), 0);
  const activeProducts = stock.filter((r) => r.is_active).length;
  const outOfStock = stock.filter((r) => r.is_active && r.on_hand <= 0).length;

  const todaySales = sales.filter((s) => s.sale_date === today);
  const sum = (rows: SaleProfitRow[], key: keyof SaleProfitRow) =>
    rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);

  const monthRevenue = sum(sales, "product_revenue");
  const monthProfit = sum(sales, "gross_profit");
  const margin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;

  const error = stockRes.error ?? lowRes.error ?? salesRes.error;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <LinkButton href="/sales/new">Record sale</LinkButton>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not load data: {error.message}. Have you run the migration in
          <code className="mx-1">supabase/migrations/</code>?
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Today's sales"
          value={money(sum(todaySales, "product_revenue"))}
          hint={`${todaySales.length} order${todaySales.length === 1 ? "" : "s"}`}
        />
        <Stat
          label="This month revenue"
          value={money(monthRevenue)}
          hint={`${sales.length} orders`}
        />
        <Stat
          label="This month gross profit"
          value={money(monthProfit)}
          hint={`${num(margin, 1)}% margin`}
          tone={monthProfit >= 0 ? "good" : "bad"}
        />
        <Stat
          label="Stock value at cost"
          value={money(stockValue)}
          hint={`${activeProducts} active products`}
        />
      </div>

      <Card
        title={`Needs restocking (${low.length}${low.length === 6 ? "+" : ""})`}
        action={
          <LinkButton href="/reports" tone="ghost">
            All reports
          </LinkButton>
        }
      >
        {low.length === 0 ? (
          <Empty>Nothing is below its reorder level. </Empty>
        ) : (
          <Table head={["Product", "SKU", "On hand", "Reorder at", "Value"]}>
            {low.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium">{p.name}</Td>
                <Td className="text-neutral-500">{p.sku}</Td>
                <Td
                  className={`tabular-nums ${p.on_hand <= 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}`}
                >
                  {p.on_hand}
                </Td>
                <Td className="tabular-nums text-neutral-500">{p.reorder_level}</Td>
                <Td className="tabular-nums">{money(p.stock_value)}</Td>
              </tr>
            ))}
          </Table>
        )}
        {outOfStock > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            {outOfStock} active product{outOfStock === 1 ? " is" : "s are"}{" "}
            completely out of stock.
          </p>
        )}
      </Card>
    </>
  );
}
