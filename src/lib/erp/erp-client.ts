import "server-only";
import type { ErpClient, StockLevel } from "@/lib/erp/client";
import type {
  CourierKey,
  CreatedOrder,
  OrderDraft,
  OrderStatus,
  PaymentMethod,
  PaymentState,
  StoreOrder,
} from "@/lib/orders/types";
import { erpDb } from "@/lib/erp/supabase";
import {
  MERCHANDISING,
  fallbackMerchandising,
  type Merchandising,
} from "@/lib/erp/merchandising";
import { availabilityFrom } from "@/lib/erp/mock";
import { sortProducts, toCard } from "@/lib/erp/sort";
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

/*
 * Postgres numeric arrives over PostgREST as a string, because a float cannot
 * hold every numeric exactly. This business has no paisa, so the safe and
 * honest conversion is to whole taka.
 */
function money(raw: number | string | null): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/*
 * The order and its lines in one round trip, via the foreign key. Columns are
 * listed for the same reason the catalogue's are: so a column added to these
 * tables later cannot appear on a customer's page by accident. `risk_note` in
 * particular is an internal judgement about a phone number and must never be
 * selected here.
 */
const ORDER_COLUMNS = `
  id, reference, public_token, status, created_at,
  customer_name, customer_phone, phone_verified_at,
  division, district, area, address_line, landmark,
  courier_preference, payment_method, payment_state,
  subtotal, delivery_fee, discount, total, amount_paid,
  has_pre_order, customer_note,
  storefront_order_items ( sku, name, qty, unit_price, is_pre_order )
`;

type OrderRow = {
  id: string;
  reference: string;
  public_token: string;
  status: OrderStatus;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  phone_verified_at: string | null;
  division: string;
  district: string;
  area: string | null;
  address_line: string;
  landmark: string | null;
  courier_preference: CourierKey | null;
  payment_method: PaymentMethod;
  payment_state: PaymentState;
  subtotal: number | string;
  delivery_fee: number | string;
  discount: number | string;
  total: number | string;
  amount_paid: number | string;
  has_pre_order: boolean;
  customer_note: string | null;
  storefront_order_items: {
    sku: string;
    name: string;
    qty: number;
    unit_price: number | string;
    is_pre_order: boolean;
  }[] | null;
};

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

  async getProductsByIds(productIds: string[]): Promise<ProductCard[]> {
    if (productIds.length === 0) return [];

    const { data, error } = await erpDb()
      .from("v_product_stock")
      .select(CATALOGUE_COLUMNS)
      .in("id", productIds);

    if (error) throw new Error(`ERP catalogue read failed: ${error.message}`);

    /*
     * No is_active filter, deliberately. A piece deactivated while it sat in
     * someone's cart must come back so checkout can say "this is no longer
     * available" — dropping it here would silently place the order without it.
     * `toProduct` maps is_active into availability, which is where that
     * decision belongs.
     */
    return (data as CatalogueRow[]).map((row) => toCard(toProduct(row)));
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
     * One RPC, not three inserts. An order row with no items is unrecoverable
     * — the customer has a confirmation and the owner has nothing to pack —
     * and supabase-js cannot open a transaction, so the transaction lives in
     * place_storefront_order(). See supabase/migrations/1001.
     *
     * snake_case keys because the payload is read by SQL, not by TypeScript.
     */
    const { data, error } = await erpDb()
      .rpc("place_storefront_order", {
        p: {
          customer_name: draft.customerName,
          customer_phone: draft.customerPhone,
          phone_verified_at: draft.phoneVerifiedAt,
          division: draft.address.division,
          district: draft.address.district,
          area: draft.address.area,
          address_line: draft.address.addressLine,
          landmark: draft.address.landmark,
          courier_preference: draft.courierPreference,
          payment_method: draft.paymentMethod,
          payment_state: draft.paymentState,
          subtotal: draft.subtotal,
          delivery_fee: draft.deliveryFee,
          discount: draft.discount,
          total: draft.total,
          amount_paid: draft.amountPaid,
          has_pre_order: draft.lines.some((line) => line.isPreOrder),
          customer_note: draft.customerNote,
          lines: draft.lines.map((line) => ({
            product_id: line.productId,
            sku: line.sku,
            name: line.name,
            qty: line.qty,
            unit_price: line.unitPrice,
            is_pre_order: line.isPreOrder,
          })),
        },
      })
      .single();

    if (error) throw new Error(`Order write failed: ${error.message}`);

    const row = data as { id: string; reference: string; public_token: string };
    return { id: row.id, reference: row.reference, token: row.public_token };
  }

  async getOrder(token: string): Promise<StoreOrder | null> {
    /*
     * Looked up by public_token, never by reference. References are sequential
     * (HQ-01001, HQ-01002…), so a page keyed on one would let anyone walk the
     * numbers and read every customer's name, phone and home address.
     */
    return this.readOrder({ public_token: token });
  }

  async findOrderByReference(reference: string): Promise<StoreOrder | null> {
    /* Owner-only — see the interface. Nothing a customer can reach calls this. */
    return this.readOrder({ reference: reference.trim() });
  }

  async findOrderForTracking(
    reference: string,
    phone: string,
  ): Promise<StoreOrder | null> {
    /*
     * Both, in the same WHERE clause. Doing it as two steps — find by
     * reference, then compare the phone in TypeScript — would answer a
     * probe for a valid reference through its timing and through anything
     * that logged the miss differently. One query, one answer.
     */
    return this.readOrder({
      reference: reference.trim(),
      customer_phone: phone,
    });
  }

  /**
   * The one place an order row becomes a StoreOrder.
   *
   * Filters are equality-only and applied as given, which is all three
   * callers need. They are column names from this file, never from a request.
   */
  private async readOrder(
    filters: Record<string, string>,
  ): Promise<StoreOrder | null> {
    let query = erpDb().from("storefront_orders").select(ORDER_COLUMNS);
    for (const [column, value] of Object.entries(filters)) {
      query = query.eq(column, value);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw new Error(`Order read failed: ${error.message}`);
    if (!data) return null;

    const row = data as unknown as OrderRow;

    return {
      id: row.id,
      reference: row.reference,
      token: row.public_token,
      status: row.status,
      placedAt: row.created_at,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      phoneVerified: row.phone_verified_at !== null,
      address: {
        division: row.division,
        district: row.district,
        area: row.area,
        addressLine: row.address_line,
        landmark: row.landmark,
      },
      courierPreference: row.courier_preference,
      paymentMethod: row.payment_method,
      paymentState: row.payment_state,
      lines: (row.storefront_order_items ?? []).map((item) => ({
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        unitPrice: money(item.unit_price),
        isPreOrder: item.is_pre_order,
      })),
      subtotal: money(row.subtotal),
      deliveryFee: money(row.delivery_fee),
      discount: money(row.discount),
      total: money(row.total),
      amountPaid: money(row.amount_paid),
      hasPreOrder: row.has_pre_order,
      customerNote: row.customer_note,
    };
  }
}
