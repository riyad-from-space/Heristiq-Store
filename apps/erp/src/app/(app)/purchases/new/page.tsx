import { createClient } from "@/lib/supabase/server";
import { todayDhaka } from "@/lib/format";
import { Card, LinkButton } from "@/components/ui";
import { PurchaseForm } from "./purchase-form";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const supabase = await createClient();

  const [productsRes, suppliersRes] = await Promise.all([
    supabase.from("products").select("id, name, sku").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">New purchase</h1>
        <LinkButton href="/purchases" tone="ghost">
          Cancel
        </LinkButton>
      </div>

      <Card>
        {(productsRes.data ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">
            Add a product first — a purchase has to reference one.
          </p>
        ) : (
          <PurchaseForm
            products={productsRes.data ?? []}
            suppliers={suppliersRes.data ?? []}
            today={todayDhaka()}
          />
        )}
      </Card>
    </>
  );
}
