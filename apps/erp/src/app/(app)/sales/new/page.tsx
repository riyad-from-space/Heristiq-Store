import { createClient } from "@/lib/supabase/server";
import { todayDhaka } from "@/lib/format";
import { Card, LinkButton } from "@/components/ui";
import { SaleForm, type SellableProduct } from "./sale-form";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_product_stock")
    .select("id, name, sku, selling_price, avg_cost, on_hand")
    .eq("is_active", true)
    .order("name");

  const products = (data ?? []) as SellableProduct[];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Record a sale</h1>
        <LinkButton href="/sales" tone="ghost">
          Cancel
        </LinkButton>
      </div>

      <Card>
        {products.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Add a product first, then record purchases so there is stock to sell.
          </p>
        ) : (
          <SaleForm products={products} today={todayDhaka()} />
        )}
      </Card>
    </>
  );
}
