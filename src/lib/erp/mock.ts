import { commerceEnv } from "@/lib/env";
import type {
  CreatedOrder,
  ErpClient,
  OrderDraft,
  StockLevel,
} from "@/lib/erp/client";
import { MERCHANDISING } from "@/lib/erp/merchandising";
import type {
  Availability,
  Product,
  ProductCard,
  ProductQuery,
} from "@/lib/erp/types";
import { sortProducts } from "@/lib/erp/sort";

/*
 * The mock catalogue.
 *
 * Seeded from the ERP's own seed files (supabase/seed/001 and 002), so the SKUs,
 * names and stock counts are the real ones — 15 units bought, then 58 more.
 *
 * PRICES ARE DEMO VALUES. The business has not set retail prices yet; the ERP
 * stores selling_price = 0 for all seven. A storefront where every price reads
 * "Price on request" cannot be design-reviewed, so the mock fills in plausible
 * numbers at roughly 4x landed cost. The real client reads the ERP and will
 * show "Price on request" until the owner sets prices on the ERP Products page.
 *
 * WC-007 is left unpriced on purpose, so the unpriced path is always visible in
 * development instead of only appearing in production.
 */
type MockRow = {
  id: string;
  sku: string;
  name: string;
  /** null = not priced. Mirrors the ERP's selling_price = 0. */
  price: number | null;
  onHand: number;
  reserved: number;
};

const ROWS: MockRow[] = [
  { id: "mock-wc-001", sku: "WC-001", name: "Large and small oval waist chain", price: 290, onHand: 2, reserved: 0 },
  { id: "mock-wc-002", sku: "WC-002", name: "Gold large and small oval waist chain", price: 310, onHand: 32, reserved: 2 },
  { id: "mock-wc-003", sku: "WC-003", name: "Long oval waist chain", price: 240, onHand: 2, reserved: 0 },
  { id: "mock-wc-004", sku: "WC-004", name: "Gold long oval waist chain", price: 260, onHand: 7, reserved: 1 },
  { id: "mock-wc-005", sku: "WC-005", name: "Silver moon waist chain", price: 250, onHand: 7, reserved: 0 },
  { id: "mock-wc-006", sku: "WC-006", name: "Golden starfish waist chain", price: 340, onHand: 17, reserved: 0 },
  /* Sold out AND unpriced — exercises pre-order and "price on request" together. */
  { id: "mock-wc-007", sku: "WC-007", name: "Golden shell conch waist chain", price: null, onHand: 0, reserved: 0 },
];

export function availabilityFrom(available: number): Availability {
  if (available <= 0) return { state: "pre_order" };
  if (available <= commerceEnv.lowStockAt) {
    return { state: "low_stock", left: available };
  }
  return { state: "in_stock" };
}

function toProduct(row: MockRow): Product {
  const m = MERCHANDISING[row.sku];
  const available = Math.max(0, row.onHand - row.reserved);

  return {
    id: row.id,
    sku: row.sku,
    slug: m.slug,
    name: row.name,
    tagline: m.tagline || null,
    description: m.description || null,
    price: row.price,
    compareAtPrice: null,
    finish: m.finish,
    motif: m.motif,
    images: m.images,
    availability: availabilityFrom(available),
    lengthInches: m.lengthInches,
    materials: m.materials,
    featured: m.featured,
    position: m.position,
  };
}

export class MockErpClient implements ErpClient {
  readonly source = "mock" as const;

  async getProducts(query: ProductQuery = {}): Promise<ProductCard[]> {
    return sortProducts(ROWS.map(toProduct), query);
  }

  async getProduct(slug: string): Promise<Product | null> {
    const row = ROWS.find((r) => MERCHANDISING[r.sku]?.slug === slug);
    return row ? toProduct(row) : null;
  }

  async getStock(productIds: string[]): Promise<StockLevel[]> {
    return ROWS.filter((r) => productIds.includes(r.id)).map((r) => ({
      productId: r.id,
      onHand: r.onHand,
      reserved: r.reserved,
      available: Math.max(0, r.onHand - r.reserved),
    }));
  }

  async createOrder(draft: OrderDraft): Promise<CreatedOrder> {
    /*
     * Nothing is persisted. The mock exists so the site can be browsed and
     * designed without credentials; an order placed against it is not an order,
     * and pretending otherwise would let a real one be silently dropped. The
     * checkout route refuses to run against the mock for exactly this reason.
     */
    console.warn(
      `[mock ErpClient] createOrder(${draft.reference}) was NOT persisted — no ERP credentials configured.`,
    );
    return { id: `mock-order-${draft.reference}`, reference: draft.reference };
  }
}
