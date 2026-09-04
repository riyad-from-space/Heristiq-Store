import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { Card, Empty, Table, Td } from "@/components/ui";
import { SupplierForm } from "./supplier-form";

export const dynamic = "force-dynamic";

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
};

export default async function SuppliersPage() {
  const supabase = await createClient();

  const [supsRes, purchasesRes] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase
      .from("purchases")
      .select("supplier_id, freight_cost, import_cost, other_cost, purchase_items(qty, unit_cost)")
      .eq("posted", true),
  ]);

  const suppliers = (supsRes.data ?? []) as SupplierRow[];

  // Total ever spent per supplier, landed (goods + freight + import + other).
  const spendBySupplier = new Map<string, number>();
  for (const p of purchasesRes.data ?? []) {
    if (!p.supplier_id) continue;
    const goods = (p.purchase_items ?? []).reduce(
      (s: number, i: { qty: number; unit_cost: number }) =>
        s + Number(i.qty) * Number(i.unit_cost),
      0,
    );
    const total =
      goods + Number(p.freight_cost) + Number(p.import_cost) + Number(p.other_cost);
    spendBySupplier.set(
      p.supplier_id,
      (spendBySupplier.get(p.supplier_id) ?? 0) + total,
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Suppliers</h1>

      <Card title="Add a supplier">
        <SupplierForm />
      </Card>

      <Card title={`All suppliers (${suppliers.length})`}>
        {suppliers.length === 0 ? (
          <Empty>No suppliers yet.</Empty>
        ) : (
          <Table head={["Name", "Phone", "Address", "Total purchased", "Note"]}>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.name}</Td>
                <Td>{s.phone ?? "—"}</Td>
                <Td className="text-neutral-500">{s.address ?? "—"}</Td>
                <Td className="tabular-nums">
                  {money(spendBySupplier.get(s.id) ?? 0)}
                </Td>
                <Td className="text-neutral-500">{s.note ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
