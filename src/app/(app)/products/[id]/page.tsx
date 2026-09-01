import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { updateProduct } from "../actions";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [productRes, catsRes, supsRes, stockRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("product_stock").select("avg_cost").eq("product_id", id).maybeSingle(),
  ]);

  // Distinguish "no such product" from "the read failed" — returning 404 for a
  // record that exists hides an outage, and falling back to 0 for a cost that
  // could not be read would let a save revalue the product down to nothing.
  if (productRes.error) throw new Error(`Could not load product: ${productRes.error.message}`);
  if (!productRes.data) notFound();

  const costKnown = !stockRes.error && stockRes.data != null;

  return (
    <>
      <h1 className="text-xl font-semibold">{productRes.data.name}</h1>
      <Card title="Edit product">
        <ProductForm
          action={updateProduct}
          categories={catsRes.data ?? []}
          suppliers={supsRes.data ?? []}
          values={{
            ...productRes.data,
            avg_cost: costKnown ? Number(stockRes.data!.avg_cost) : undefined,
            avg_cost_known: costKnown,
          }}
          submitLabel="Save changes"
        />
      </Card>
      <p className="text-xs text-neutral-500">
        Quantity is not editable here — it is derived from purchases, sales and
        adjustments. Use the Stock page to correct a count. Changing the unit
        cost is recorded as a correction and applies everywhere from now on;
        sales already recorded keep the cost they were sold at.
      </p>
    </>
  );
}
