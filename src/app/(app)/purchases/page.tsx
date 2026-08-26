import { createClient } from "@/lib/supabase/server";
import { date, money } from "@/lib/format";
import { Card, Empty, LinkButton, Table, Td } from "@/components/ui";
import { one } from "@/lib/types";

export const dynamic = "force-dynamic";

type PurchaseRow = {
  id: string;
  purchase_date: string;
  freight_cost: number;
  import_cost: number;
  other_cost: number;
  note: string | null;
  suppliers: { name: string } | { name: string }[] | null;
  purchase_items: { qty: number; unit_cost: number; unit_landed_cost: number }[];
};

export default async function PurchasesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("purchases")
    .select(
      "id, purchase_date, freight_cost, import_cost, other_cost, note, suppliers(name), purchase_items(qty, unit_cost, unit_landed_cost)",
    )
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const purchases = (data ?? []) as unknown as PurchaseRow[];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <LinkButton href="/purchases/new">New purchase</LinkButton>
      </div>

      <Card title={`Recent purchases (${purchases.length})`}>
        {error && <p className="text-sm text-red-600">{error.message}</p>}
        {purchases.length === 0 ? (
          <Empty>
            No purchases recorded yet. Recording one is what puts stock in.
          </Empty>
        ) : (
          <Table
            head={["Date", "Supplier", "Lines", "Units", "Goods", "Extras", "Total landed"]}
          >
            {purchases.map((p) => {
              const goods = p.purchase_items.reduce(
                (s, i) => s + Number(i.qty) * Number(i.unit_cost),
                0,
              );
              const extras =
                Number(p.freight_cost) + Number(p.import_cost) + Number(p.other_cost);
              const units = p.purchase_items.reduce((s, i) => s + Number(i.qty), 0);

              return (
                <tr key={p.id}>
                  <Td className="whitespace-nowrap">{date(p.purchase_date)}</Td>
                  <Td className="font-medium">{one(p.suppliers)?.name ?? "—"}</Td>
                  <Td className="tabular-nums">{p.purchase_items.length}</Td>
                  <Td className="tabular-nums">{units}</Td>
                  <Td className="tabular-nums">{money(goods)}</Td>
                  <Td className="tabular-nums text-neutral-500">{money(extras)}</Td>
                  <Td className="tabular-nums font-medium">{money(goods + extras)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
