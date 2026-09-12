import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { updateProduct } from "../actions";
import { ProductForm } from "../product-form";
import { Photographs } from "./photographs";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [productRes, catsRes, supsRes, stockRes, imagesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("product_stock").select("avg_cost").eq("product_id", id).maybeSingle(),
    supabase
      .from("product_images")
      .select("id, public_id, alt, position, width, height, format, bytes")
      .eq("product_id", id)
      .order("position")
      .order("created_at"),
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

      {/*
       * Photographs are their own card rather than a field on the form, because
       * they do not save with it — each upload, reorder and removal takes
       * effect on its own. Putting them inside a form with a "Save changes"
       * button would promise a transaction that does not exist.
       */}
      <Card title="Photographs">
        <Photographs
          productId={id}
          images={imagesRes.data ?? []}
          cloudName={process.env.CLOUDINARY_CLOUD_NAME ?? ""}
          folder={process.env.CLOUDINARY_FOLDER || "heristiq"}
          configured={cloudinaryConfigured()}
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
