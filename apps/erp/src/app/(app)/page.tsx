import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { firstOfNextMonth, money, num, todayDhaka } from "@/lib/format";
import { Card, Empty, LinkButton, Stat, Table, Td } from "@/components/ui";
import type { ProductStockRow, SaleProfitRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayDhaka();
  const monthStart = `${today.slice(0, 7)}-01`;
  // Bound both ends: without an upper bound a future-dated sale counts toward
  // this month every month until that date actually arrives. Use the first of
  // next month with an exclusive upper bound — a literal "-31" is not a real
  // date in a 30-day month and Postgres rejects it outright.
  const nextMonthStart = firstOfNextMonth(today);

  const [stockRes, lowRes, salesRes, ordersRes, preOrdersRes, messagesRes] =
    await Promise.all([
      supabase
        .from("v_product_stock")
        .select("stock_value, on_hand, available, is_active"),
      supabase.from("v_low_stock").select("*").limit(6),
      supabase
        .from("v_sale_profit")
        .select("sale_date, product_revenue, cogs, gross_profit, status")
        .gte("sale_date", monthStart)
        .lt("sale_date", nextMonthStart)
        .eq("posted", true)
        .not("status", "in", "(cancelled,returned)"),
      /*
       * THE THREE QUERIES THIS PAGE WAS MISSING.
       *
       * Every figure above comes from `sales` — the ERP's own ledger — and a
       * sale only exists once someone has pressed "Record sale" on a delivered
       * order. So the dashboard was accurate and almost empty: at the time of
       * writing it reported one month's revenue as 920 taka from three sales,
       * while 32 open pre-orders worth 19,060 and a website order sat
       * elsewhere in the same database, unmentioned.
       *
       * That is not a rounding error, it is the difference between "the shop
       * is quiet" and "there is a day's work waiting". Nothing below changes
       * how revenue is counted — delivered-and-collected is still the only
       * thing that becomes revenue, which is right for cash on delivery. These
       * are the things that need DOING, which is what a dashboard is for.
       */
      supabase
        .from("storefront_orders")
        .select("reference, status, total")
        .not("status", "in", "(delivered,cancelled,returned)"),
      supabase
        .from("v_pre_orders")
        .select("total_amount, amount_due, status, converted_sale_id")
        .in("status", ["pending", "confirmed"])
        .is("converted_sale_id", null),
      /* handled_at IS NULL, not handled = false — the table records WHEN a
         message was dealt with, not whether. There is no boolean column. */
      supabase.from("storefront_messages").select("id").is("handled_at", null),
    ]);

  const stock = (stockRes.data ?? []) as Pick<
    ProductStockRow,
    "stock_value" | "on_hand" | "available" | "is_active"
  >[];
  const low = (lowRes.data ?? []) as ProductStockRow[];
  const sales = (salesRes.data ?? []) as SaleProfitRow[];

  // Count and value the same set — the hint says "active products", so the
  // headline figure must not quietly include retired ones.
  const activeStock = stock.filter((r) => r.is_active);
  const stockValue = activeStock.reduce((s, r) => s + Number(r.stock_value), 0);
  const activeProducts = activeStock.length;
  // Out of stock means nothing left to promise, so it counts availability.
  const outOfStock = activeStock.filter((r) => r.available <= 0).length;

  const todaySales = sales.filter((s) => s.sale_date === today);
  const sum = (rows: SaleProfitRow[], key: keyof SaleProfitRow) =>
    rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);

  const monthRevenue = sum(sales, "product_revenue");
  const monthProfit = sum(sales, "gross_profit");
  const margin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;

  /*
   * Open website orders and open pre-orders — the work waiting, as opposed to
   * the money already banked.
   *
   * Both degrade to nothing rather than blanking the page: a database without
   * migration 1001 has no storefront_orders at all, and the rest of the
   * dashboard is still worth showing.
   */
  const openOrders = ordersRes.data ?? [];
  const openOrderValue = openOrders.reduce(
    (s, o) => s + Number(o.total ?? 0),
    0,
  );
  const openPreOrders = preOrdersRes.data ?? [];
  const preOrderDue = openPreOrders.reduce(
    (s, p) => s + Number(p.amount_due ?? 0),
    0,
  );
  const unhandledMessages = messagesRes.data?.length ?? 0;

  /* Only the three ORIGINAL queries can blank this page. The three added
     above are supplementary — a shop running without them still needs its
     stock value — so their failure must not replace the dashboard with an
     error about a migration. */
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

      {/*
       * WAITING FOR YOU — above the money, because it is the part that needs a
       * decision today. Hidden entirely when there is nothing waiting, so an
       * empty shop does not show three zeroes.
       */}
      {(openOrders.length > 0 ||
        openPreOrders.length > 0 ||
        unhandledMessages > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Website orders to act on"
            value={openOrders.length}
            tone={openOrders.length > 0 ? "warn" : "neutral"}
            hint={
              openOrders.length > 0 ? (
                <Link href="/orders" className="underline underline-offset-2">
                  {money(openOrderValue)} — open them
                </Link>
              ) : (
                "Nothing waiting"
              )
            }
          />
          <Stat
            label="Open pre-orders"
            value={openPreOrders.length}
            hint={
              openPreOrders.length > 0 ? (
                <Link
                  href="/pre-orders"
                  className="underline underline-offset-2"
                >
                  {money(preOrderDue)} still due
                </Link>
              ) : (
                "None outstanding"
              )
            }
          />
          <Stat
            label="Unread messages"
            value={unhandledMessages}
            tone={unhandledMessages > 0 ? "warn" : "neutral"}
            hint={
              unhandledMessages > 0 ? (
                <Link href="/messages" className="underline underline-offset-2">
                  Read them
                </Link>
              ) : (
                "All handled"
              )
            }
          />
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
                <Td className="tabular-nums text-neutral-500">
                  {p.reorder_level}
                </Td>
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
