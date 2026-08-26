import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money, num } from "@/lib/format";
import { Badge, Card, Empty, Table, Td } from "@/components/ui";
import type { ProductStockRow } from "@/lib/types";
import { createProduct } from "./actions";
import { ProductForm } from "./product-form";
import { CategoryForm } from "./category-form";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [productsRes, catsRes, supsRes] = await Promise.all([
    supabase.from("v_product_stock").select("*").order("name"),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const products = (productsRes.data ?? []) as ProductStockRow[];
  const categories = catsRes.data ?? [];
  const suppliers = supsRes.data ?? [];

  const totalValue = products.reduce((s, p) => s + Number(p.stock_value), 0);

  return (
    <>
      <h1 className="text-xl font-semibold">Products</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Add a product" className="lg:col-span-2">
          <ProductForm
            action={createProduct}
            categories={categories}
            suppliers={suppliers}
            submitLabel="Add product"
            resetOnSuccess
          />
        </Card>
        <Card title="Categories">
          <CategoryForm />
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <li key={c.id}>
                <Badge>{c.name}</Badge>
              </li>
            ))}
            {categories.length === 0 && (
              <li className="text-sm text-neutral-500">None yet.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card
        title={`All products (${products.length})`}
        action={
          <span className="text-sm text-neutral-500">
            Stock value {money(totalValue)}
          </span>
        }
      >
        {productsRes.error && (
          <p className="text-sm text-red-600">{productsRes.error.message}</p>
        )}
        {products.length === 0 ? (
          <Empty>No products yet. Add your first one above.</Empty>
        ) : (
          <Table
            head={[
              "Product",
              "SKU",
              "On hand",
              "Avg cost",
              "Price",
              "Margin",
              "Value",
              "",
            ]}
          >
            {products.map((p) => (
              <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                <Td className="font-medium">
                  {p.name}
                  {p.category && (
                    <span className="ml-2 text-xs text-neutral-500">
                      {p.category}
                    </span>
                  )}
                </Td>
                <Td className="text-neutral-500">{p.sku}</Td>
                <Td
                  className={`tabular-nums ${
                    p.is_active && p.on_hand <= p.reorder_level
                      ? "font-semibold text-amber-600 dark:text-amber-400"
                      : ""
                  }`}
                >
                  {p.on_hand}
                </Td>
                <Td className="tabular-nums text-neutral-500">
                  {money(p.avg_cost, true)}
                </Td>
                <Td className="tabular-nums">{money(p.selling_price)}</Td>
                <Td className="tabular-nums">
                  {p.margin_pct === null ? (
                    "—"
                  ) : (
                    <span
                      className={
                        Number(p.unit_margin) < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }
                    >
                      {num(p.margin_pct, 1)}%
                    </span>
                  )}
                </Td>
                <Td className="tabular-nums">{money(p.stock_value)}</Td>
                <Td>
                  <Link
                    href={`/products/${p.id}`}
                    className="text-sm text-neutral-500 underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
