import { createClient } from "@/lib/supabase/server";
import { dateTime, money } from "@/lib/format";
import { Badge, Card, Empty, Table, Td } from "@/components/ui";
import { MOVEMENT_LABELS, one, type MovementType } from "@/lib/types";
import { AdjustForm } from "./adjust-form";

export const dynamic = "force-dynamic";

type MovementRow = {
  id: string;
  type: MovementType;
  qty_delta: number;
  unit_cost: number;
  note: string | null;
  created_at: string;
  products: { name: string; sku: string } | { name: string; sku: string }[] | null;
};

const TONE: Record<MovementType, "neutral" | "good" | "warn" | "bad"> = {
  purchase_in: "good",
  sale_out: "neutral",
  return_in: "warn",
  damage_out: "bad",
  adjustment: "warn",
};

export default async function StockPage() {
  const supabase = await createClient();

  const [movementsRes, productsRes] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("id, type, qty_delta, unit_cost, note, created_at, products(name, sku)")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("v_product_stock")
      .select("id, name, sku, on_hand, reserved, available")
      .eq("is_active", true)
      .order("name"),
  ]);

  const movements = (movementsRes.data ?? []) as unknown as MovementRow[];

  return (
    <>
      <h1 className="text-xl font-semibold">Stock</h1>

      <Card title="Adjust stock">
        <p className="mb-4 text-sm text-neutral-500">
          Use this when the shelf count does not match the system — a miscount, a
          damaged piece, or a gift. Every adjustment is recorded permanently
          rather than overwriting the number. Adjust against what is physically
          on the shelf, not what is free to sell: pre-ordered items are still
          there, just already promised.
        </p>
        <AdjustForm products={productsRes.data ?? []} />
      </Card>

      <Card title="Stock movement history">
        {movementsRes.error && (
          <p className="text-sm text-red-600">{movementsRes.error.message}</p>
        )}
        {movements.length === 0 ? (
          <Empty>No stock movements yet.</Empty>
        ) : (
          <Table head={["When", "Product", "Type", "Change", "Unit cost", "Note"]}>
            {movements.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-neutral-500">
                  {dateTime(m.created_at)}
                </Td>
                <Td className="font-medium">
                  {one(m.products)?.name ?? "—"}
                  <span className="ml-2 text-xs text-neutral-500">
                    {one(m.products)?.sku}
                  </span>
                </Td>
                <Td>
                  <Badge tone={TONE[m.type]}>{MOVEMENT_LABELS[m.type]}</Badge>
                </Td>
                <Td
                  className={`tabular-nums font-medium ${
                    m.qty_delta > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {m.qty_delta > 0 ? `+${m.qty_delta}` : m.qty_delta}
                </Td>
                <Td className="tabular-nums text-neutral-500">
                  {money(m.unit_cost, true)}
                </Td>
                <Td className="text-neutral-500">{m.note ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
