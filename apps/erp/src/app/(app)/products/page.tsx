import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money, num } from "@/lib/format";
import { Card, Empty, Table, Td } from "@/components/ui";
import type { ProductStockRow } from "@/lib/types";
import { createProduct } from "./actions";
import { ProductForm } from "./product-form";
import { CategoryForm, CategoryEditor } from "./category-form";

export const dynamic = "force-dynamic";

/*
 * A 40px square of the product's first photograph.
 *
 * Built here rather than imported from the storefront: the two apps must not
 * import each other (an ESLint rule enforces it both ways), and this is one
 * URL rather than the storefront's whole srcset machinery — a fixed-size
 * thumbnail needs no responsive variants.
 *
 * w_80 for a 40px box, so it stays sharp on a phone's 2x screen. Returns null
 * when there is no photograph OR no Cloudinary account, so an unconfigured
 * deployment shows the dashed "no photograph" square rather than a broken
 * image icon.
 */
function thumb(p: ProductStockRow): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const folder = process.env.CLOUDINARY_FOLDER || "heristiq";
  const id = p.images?.[0]?.id;
  if (!cloud || !id) return null;
  const full = id.startsWith(`${folder}/`) ? id : `${folder}/${id}`;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_80,ar_1:1,c_fill,g_auto/${full}`;
}

export default async function ProductsPage() {
  const supabase = await createClient();

  const [productsRes, catsRes, supsRes] = await Promise.all([
    supabase.from("v_product_stock").select("*").order("name"),
    /* Ordered the way the SHOP orders them, so this list is what the
       customer's menu looks like rather than an alphabetical coincidence. */
    supabase
      .from("categories")
      .select("id, name, slug, blurb, position, is_active")
      .order("position")
      .order("name"),
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
          {/* A column, not a row of badges: each one now carries its web
              address, its menu position and whether the shop shows it, and
              that does not fit in a pill. */}
          <ul className="mt-3 space-y-1.5">
            {categories.map((c) => (
              <li key={c.id}>
                <CategoryEditor category={c} />
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
              "Reserved",
              "Available",
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
                  <div className="flex items-center gap-3">
                    {/*
                     * A thumbnail, so a row is identifiable without opening it.
                     *
                     * The owner's problem was literal: eight bracelets called
                     * BR-001 to BR-008, and no way to tell from this table
                     * which code belongs to which piece — which has to be
                     * known before a stock count can be entered against one.
                     * A name can describe a bracelet; only the picture
                     * identifies it.
                     *
                     * A plain <img> against Cloudinary, not next/image: the
                     * storefront does the same, and putting Next's optimiser
                     * in front of Cloudinary would be two resizes and two
                     * caches for a 40px square.
                     */}
                    {thumb(p) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- see above
                      <img
                        src={thumb(p)!}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        className="size-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      /* Not an empty gap: "no photograph" is the state the
                         owner most needs to spot, because the piece cannot
                         sell without one. */
                      <span
                        title="No photograph yet"
                        className="grid size-10 shrink-0 place-items-center rounded-md border border-dashed border-neutral-300 text-[0.625rem] text-neutral-400 dark:border-neutral-700"
                      >
                        —
                      </span>
                    )}
                    <span className="min-w-0">
                      {/*
                       * The name is the way in, not just the "Edit" link in the
                       * last column.
                       *
                       * That link is small, grey, and on a phone it sits past nine
                       * numeric columns of horizontal scrolling — so in practice
                       * the product page was unreachable without knowing it was
                       * there. That page is now where photographs are uploaded,
                       * which makes it the most visited page in the ERP rather
                       * than a rarely-used edit form.
                       *
                       * The first column is where a reader's eye already is, and
                       * tapping a row's name to open it is what every table on
                       * every other site does.
                       */}
                      <Link
                        href={`/products/${p.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.category && (
                        <span className="ml-2 text-xs text-neutral-500">
                          {p.category}
                        </span>
                      )}
                    </span>
                  </div>
                </Td>
                <Td className="text-neutral-500">{p.sku}</Td>
                <Td className="tabular-nums text-neutral-500">{p.on_hand}</Td>
                <Td
                  className={`tabular-nums ${
                    p.reserved > 0
                      ? "text-neutral-700 dark:text-neutral-300"
                      : "text-neutral-400"
                  }`}
                  title={
                    p.reserved > 0 ? "Claimed by open pre-orders" : undefined
                  }
                >
                  {p.reserved > 0 ? p.reserved : "—"}
                </Td>
                {/* Available, not on hand, is what drives the low-stock warning —
                    pre-ordered items are still on the shelf but already promised. */}
                <Td
                  className={`tabular-nums font-medium ${
                    p.is_active && p.available <= p.reorder_level
                      ? "text-amber-600 dark:text-amber-400"
                      : ""
                  }`}
                >
                  {p.available}
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
