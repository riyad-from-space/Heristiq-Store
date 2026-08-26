import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { todayDhaka } from "@/lib/format";
import { SaleForm, type SellableProduct } from "../new/sale-form";

export const dynamic = "force-dynamic";

export default async function EditSalePage({ params }: PageProps<"/sales/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [saleRes, itemsRes, productsRes] = await Promise.all([
    supabase.from("sales").select("*").eq("id", id).maybeSingle(),
    supabase.from("sale_items").select("product_id, qty, unit_price").eq("sale_id", id),
    supabase
      .from("v_product_stock")
      .select("id, name, sku, selling_price, avg_cost, on_hand")
      .eq("is_active", true)
      .order("name"),
  ]);

  const sale = saleRes.data;
  if (!sale) notFound();

  // Reversed sales are read-only: stock has already gone back, so re-editing
  // the lines would double-count. Record a new sale instead.
  const reversed = sale.status === "cancelled" || sale.status === "returned";

  return (
    <>
      <h1 className="text-xl font-semibold">
        Edit sale{sale.customer_name ? ` — ${sale.customer_name}` : ""}
      </h1>

      {reversed ? (
        <Card title="This sale was reversed">
          <p className="text-sm text-neutral-500">
            It is marked <strong>{sale.status}</strong> and the stock has already
            gone back. Record a new sale rather than editing this one.
          </p>
        </Card>
      ) : (
        <Card title="Sale details">
          <SaleForm
            products={(productsRes.data ?? []) as SellableProduct[]}
            today={todayDhaka()}
            values={{
              id: sale.id,
              sale_date: sale.sale_date,
              channel: sale.channel,
              status: sale.status,
              customer_name: sale.customer_name,
              customer_phone: sale.customer_phone,
              customer_address: sale.customer_address,
              discount: Number(sale.discount),
              delivery_charge: Number(sale.delivery_charge),
              delivery_cost: Number(sale.delivery_cost),
              note: sale.note,
              lines: (itemsRes.data ?? []).map((l) => ({
                product_id: l.product_id as string,
                qty: Number(l.qty),
                unit_price: Number(l.unit_price),
              })),
            }}
          />
        </Card>
      )}

      <p className="text-xs text-neutral-500">
        Changing a quantity writes a correcting stock movement, so the ledger
        stays a true record of what moved. To cancel or return the whole sale,
        use the buttons on the Sales page.
      </p>
    </>
  );
}
