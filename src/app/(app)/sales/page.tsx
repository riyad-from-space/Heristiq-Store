import { createClient } from "@/lib/supabase/server";
import { date, money } from "@/lib/format";
import { Badge, Card, Empty, LinkButton, Stat, Table, Td } from "@/components/ui";
import type { SaleProfitRow, SaleStatus } from "@/lib/types";
import { VoidSaleButtons } from "./sale-actions";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<SaleStatus, "neutral" | "good" | "warn" | "bad"> = {
  pending: "warn",
  confirmed: "neutral",
  delivered: "good",
  cancelled: "bad",
  returned: "bad",
};

export default async function SalesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_sale_profit")
    .select("*")
    .order("sale_date", { ascending: false })
    .limit(100);

  const sales = (data ?? []) as SaleProfitRow[];
  // Unposted sales have no cost snapshot yet, so they would read as pure profit.
  const live = sales.filter(
    (s) => s.posted && !["cancelled", "returned"].includes(s.status),
  );

  const revenue = live.reduce((s, r) => s + Number(r.product_revenue), 0);
  const profit = live.reduce((s, r) => s + Number(r.gross_profit), 0);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Sales</h1>
        <LinkButton href="/sales/new">Record sale</LinkButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Orders shown" value={live.length} hint="last 100 records" />
        <Stat label="Revenue" value={money(revenue)} />
        <Stat
          label="Gross profit"
          value={money(profit)}
          tone={profit >= 0 ? "good" : "bad"}
        />
      </div>

      <Card title="Recent sales">
        {error && <p className="text-sm text-red-600">{error.message}</p>}
        {sales.length === 0 ? (
          <Empty>No sales recorded yet.</Empty>
        ) : (
          <Table
            head={[
              "Date",
              "Customer",
              "Channel",
              "Units",
              "Revenue",
              "Cost",
              "Delivery",
              "Profit",
              "Status",
              "",
            ]}
          >
            {sales.map((s) => {
              const voided = ["cancelled", "returned"].includes(s.status);
              return (
                <tr key={s.id} className={voided ? "opacity-50" : ""}>
                  <Td className="whitespace-nowrap">{date(s.sale_date)}</Td>
                  <Td className="font-medium">
                    {s.customer_name ?? "—"}
                    {s.customer_phone && (
                      <span className="block text-xs text-neutral-500">
                        {s.customer_phone}
                      </span>
                    )}
                  </Td>
                  <Td className="capitalize text-neutral-500">{s.channel}</Td>
                  <Td className="tabular-nums">{s.units}</Td>
                  <Td className="tabular-nums">{money(s.product_revenue)}</Td>
                  <Td className="tabular-nums text-neutral-500">{money(s.cogs)}</Td>
                  <Td
                    className={`tabular-nums ${
                      Number(s.net_delivery) < 0 ? "text-amber-600 dark:text-amber-400" : "text-neutral-500"
                    }`}
                  >
                    {money(s.net_delivery)}
                  </Td>
                  <Td
                    className={`tabular-nums font-medium ${
                      Number(s.gross_profit) < 0 ? "text-red-600 dark:text-red-400" : ""
                    }`}
                  >
                    {money(s.gross_profit)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                  </Td>
                  <Td>
                    <VoidSaleButtons id={s.id} disabled={voided} />
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
