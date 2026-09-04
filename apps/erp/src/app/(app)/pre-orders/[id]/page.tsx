import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { todayDhaka } from "@/lib/format";
import type { PreOrderItemRow } from "@/lib/types";
import { PreOrderForm, type CatalogueProduct } from "../pre-order-form";

export const dynamic = "force-dynamic";

export default async function EditPreOrderPage({ params }: PageProps<"/pre-orders/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [orderRes, itemsRes, productsRes] = await Promise.all([
    supabase.from("pre_orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("v_pre_order_items").select("*").eq("pre_order_id", id),
    supabase
      .from("v_product_stock")
      .select("id, name, sku, selling_price, available")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (orderRes.error) {
    throw new Error(`Could not load pre-order: ${orderRes.error.message}`);
  }
  const order = orderRes.data;
  if (!order) notFound();

  const items = (itemsRes.data ?? []) as PreOrderItemRow[];
  const delivered = order.converted_sale_id != null;

  return (
    <>
      <h1 className="text-xl font-semibold">
        Pre-order — {order.customer_name}
      </h1>

      {delivered ? (
        <Card title="Already delivered">
          <p className="text-sm text-neutral-500">
            This pre-order has been delivered and recorded as a sale, so it can no
            longer be changed. Edit the sale itself if something was wrong.
          </p>
        </Card>
      ) : (
        <Card title="Edit pre-order">
          <PreOrderForm
            products={(productsRes.data ?? []) as CatalogueProduct[]}
            today={todayDhaka()}
            values={{
              id: order.id,
              customer_name: order.customer_name,
              customer_phone: order.customer_phone,
              customer_address: order.customer_address,
              amount_paid: Number(order.amount_paid),
              order_date: order.order_date,
              expected_date: order.expected_date,
              status: order.status,
              note: order.note,
              lines: items.map((l) => ({
                product_id: l.product_id,
                item_note: l.item_note,
                qty: Number(l.qty),
                unit_price: Number(l.unit_price),
              })),
            }}
          />
        </Card>
      )}

      <p className="text-xs text-neutral-500">
        Payment status is worked out from the advance against the order total, so it
        stays correct on its own. These items are reserved but still in stock —
        delivering the order is what moves them.
      </p>
    </>
  );
}
