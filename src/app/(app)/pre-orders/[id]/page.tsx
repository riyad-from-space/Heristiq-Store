import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { todayDhaka } from "@/lib/format";
import { PreOrderForm, type CatalogueProduct } from "../pre-order-form";

export const dynamic = "force-dynamic";

export default async function EditPreOrderPage({
  params,
}: PageProps<"/pre-orders/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [orderRes, productsRes] = await Promise.all([
    supabase.from("pre_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("products")
      .select("id, name, sku, selling_price")
      .eq("is_active", true)
      .order("name"),
  ]);

  const order = orderRes.data;
  if (!order) notFound();

  return (
    <>
      <h1 className="text-xl font-semibold">
        Pre-order — {order.customer_name}
      </h1>

      <Card title="Edit pre-order">
        <PreOrderForm
          products={(productsRes.data ?? []) as CatalogueProduct[]}
          today={todayDhaka()}
          values={{
            id: order.id,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            product_id: order.product_id,
            item_note: order.item_note,
            qty: Number(order.qty),
            total_amount: Number(order.total_amount),
            amount_paid: Number(order.amount_paid),
            order_date: order.order_date,
            expected_date: order.expected_date,
            status: order.status,
            note: order.note,
          }}
        />
      </Card>

      <p className="text-xs text-neutral-500">
        Payment status is worked out from what has been paid against the total, so
        it stays correct on its own. Fulfilling a pre-order does not move stock —
        record the sale on the Sales page when you deliver.
      </p>
    </>
  );
}
