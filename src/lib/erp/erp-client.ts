import "server-only";
import type {
  CreatedOrder,
  ErpClient,
  OrderDraft,
  StockLevel,
} from "@/lib/erp/client";
import { erpDb } from "@/lib/erp/supabase";
import {
  MERCHANDISING,
  fallbackMerchandising,
  type Merchandising,
} from "@/lib/erp/merchandising";
import { availabilityFrom } from "@/lib/erp/mock";
import { sortProducts } from "@/lib/erp/sort";
import type { Product, ProductCard, ProductQuery } from "@/lib/erp/types";
import { slugify } from "@/lib/utils";

/*
 * The real catalogue, read from the ERP's Supabase Postgres.
 *
 * Source of truth for price and stock is v_product_stock — the ERP's own view,
 * which already derives on_hand from the append-only ledger and reserved from
 * open pre-orders. The storefront never computes stock; it reads what the ERP
 * concluded.
 *
 * COLUMN LIST IS THE SECURITY BOUNDARY. v_product_stock also exposes avg_cost,
 * stock_value, unit_margin, margin_pct and supplier. None of those may reach a
 * customer, so they are not selected. Do not replace this with select("*").
 */
const CATALOGUE_COLUMNS =
  "id, sku, name, selling_price, is_active, on_hand, reserved, available";

type CatalogueRow = {
  id: string;
  sku: string;
  name: string;
  selling_price: number | string;
  is_active: boolean;
  on_hand: number;
  reserved: number;
  available: number;
};

/**
 * The ERP stores selling_price = 0 for "not decided yet" — there is no nullable
 * price column, and 0 is its default. Rendering ৳0 would be a lie, so zero and
 * anything non-numeric both become null, which the UI shows as
 * "Price on request" with add-to-cart disabled.
 */
function priceOf(raw: number | string | null): number | null {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function merchandisingFor(row: CatalogueRow): Merchandising {
  return (
    MERCHANDISING[row.sku] ??
    fallbackMerchandising(row.sku, row.name, slugify(row.name))
  );
}

function toProduct(row: CatalogueRow): Product {
  const m = merchandisingFor(row);

  return {
    id: row.id,
    sku: row.sku,
    slug: m.slug,
    name: row.name,
    tagline: m.tagline || null,
    description: m.description || null,
    price: priceOf(row.selling_price),
    compareAtPrice: null,
    finish: m.finish,
    motif: m.motif,
    images: m.images,
    /*
     * `available`, not `on_hand`. A unit claimed by an open pre-order is still
     * physically in the drawer, so the ERP leaves on_hand alone — but it is
     * already promised to someone, and selling it twice is the one mistake a
     * storefront must not make.
     */
    availability: availabilityFrom(row.available ?? 0),
    lengthInches: m.lengthInches,
    materials: m.materials,
    featured: m.featured,
    position: m.position,
  };
}

async function fetchCatalogue(): Promise<Product[]> {
  const { data, error } = await erpDb()
    .from("v_product_stock")
    .select(CATALOGUE_COLUMNS)
    .eq("is_active", true);

  if (error) {
    throw new Error(`ERP catalogue read failed: ${error.message}`);
  }
  return (data as CatalogueRow[]).map(toProduct);
}

export class SupabaseErpClient implements ErpClient {
  readonly source = "erp" as const;

  async getProducts(query: ProductQuery = {}): Promise<ProductCard[]> {
    return sortProducts(await fetchCatalogue(), query);
  }

  async getProduct(slug: string): Promise<Product | null> {
    /*
     * The slug lives in the merchandising overlay, not in the database, so it
     * cannot be a WHERE clause yet. Resolving slug → SKU locally first keeps
     * this to one indexed lookup instead of scanning the catalogue.
     *
     * When storefront_products lands in phase 6 the slug becomes a column and
     * this becomes .eq("slug", slug).
     */
    const sku = Object.keys(MERCHANDISING).find(
      (key) => MERCHANDISING[key].slug === slug,
    );

    const query = erpDb()
      .from("v_product_stock")
      .select(CATALOGUE_COLUMNS)
      .eq("is_active", true);

    const { data, error } = sku
      ? await query.eq("sku", sku).maybeSingle()
      : /* An unknown slug may still be a product added in the ERP since this
           file was written, whose slug comes from slugify(name). */
        await query.then((res) => ({
          ...res,
          data:
            (res.data as CatalogueRow[] | null)?.find(
              (row) => slugify(row.name) === slug,
            ) ?? null,
        }));

    if (error) throw new Error(`ERP product read failed: ${error.message}`);
    return data ? toProduct(data as CatalogueRow) : null;
  }

  async getStock(productIds: string[]): Promise<StockLevel[]> {
    if (productIds.length === 0) return [];

    const { data, error } = await erpDb()
      .from("v_product_stock")
      .select("id, on_hand, reserved, available")
      .in("id", productIds);

    if (error) throw new Error(`ERP stock read failed: ${error.message}`);

    return (data as Pick<CatalogueRow, "id" | "on_hand" | "reserved" | "available">[]).map(
      (row) => ({
        productId: row.id,
        onHand: row.on_hand ?? 0,
        reserved: row.reserved ?? 0,
        available: row.available ?? 0,
      }),
    );
  }

  async createOrder(draft: OrderDraft): Promise<CreatedOrder> {
    /*
     * Phase 3. Orders need their own tables (storefront_orders, order_items,
     * order_events) plus the RPC that converts a delivered order into an ERP
     * sale via post_sale(). Writing a half-order now would leave rows nothing
     * can reconcile, so this throws until that migration exists.
     */
    throw new Error(
      `Cannot record order ${draft.reference}: createOrder lands in phase 3 ` +
        "(checkout), with the storefront_orders migration. See README → Build order.",
    );
  }
}
