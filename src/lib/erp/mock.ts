import { commerceEnv } from "@/lib/env";
import type { ErpClient, StockLevel } from "@/lib/erp/client";
import type {
  CreatedOrder,
  OrderDraft,
  StoreOrder,
} from "@/lib/orders/types";
import { MERCHANDISING } from "@/lib/erp/merchandising";
import type {
  Availability,
  Product,
  ProductCard,
  ProductQuery,
} from "@/lib/erp/types";
import { sortProducts, toCard } from "@/lib/erp/sort";

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

/*
 * Orders placed against the mock, for the life of this server process.
 *
 * Module scope rather than instance scope because Next.js may build a new
 * client per request in development; an instance field would lose the order
 * between placing it and rendering the confirmation page one redirect later.
 */
const MOCK_ORDERS = new Map<string, StoreOrder>();

export class MockErpClient implements ErpClient {
  readonly source = "mock" as const;

  async getProducts(query: ProductQuery = {}): Promise<ProductCard[]> {
    return sortProducts(ROWS.map(toProduct), query);
  }

  async getProduct(slug: string): Promise<Product | null> {
    const row = ROWS.find((r) => MERCHANDISING[r.sku]?.slug === slug);
    return row ? toProduct(row) : null;
  }

  async getProductsByIds(productIds: string[]): Promise<ProductCard[]> {
    return ROWS.filter((r) => productIds.includes(r.id)).map((r) =>
      toCard(toProduct(r)),
    );
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
     * Kept in module memory, not in a database.
     *
     * The mock exists so the site can be browsed, designed and checked out
     * end to end with no credentials, and a confirmation page that cannot
     * render is a checkout that cannot be reviewed. So the order is real
     * enough to redirect to and gone on the next server restart.
     *
     * The honesty this needs is on the confirmation page, which shows an
     * unmissable demo banner whenever the source is the mock. Silently
     * accepting an order nobody will ever pack is the one outcome worth
     * engineering against.
     */
    const seq = MOCK_ORDERS.size + 1001;
    const created: CreatedOrder = {
      id: `mock-order-${seq}`,
      reference: `HQ-${String(seq).padStart(5, "0")}`,
      token: `mock${String(seq).padStart(6, "0")}`,
    };

    MOCK_ORDERS.set(created.token, {
      reference: created.reference,
      token: created.token,
      status: "placed",
      placedAt: new Date().toISOString(),
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      phoneVerified: draft.phoneVerifiedAt !== null,
      address: draft.address,
      courierPreference: draft.courierPreference,
      paymentMethod: draft.paymentMethod,
      paymentState: draft.paymentState,
      lines: draft.lines.map((line) => ({
        sku: line.sku,
        name: line.name,
        qty: line.qty,
        unitPrice: line.unitPrice,
        isPreOrder: line.isPreOrder,
      })),
      subtotal: draft.subtotal,
      deliveryFee: draft.deliveryFee,
      discount: draft.discount,
      total: draft.total,
      amountPaid: draft.amountPaid,
      hasPreOrder: draft.lines.some((line) => line.isPreOrder),
      customerNote: draft.customerNote,
    });

    console.warn(
      `[mock ErpClient] order ${created.reference} was NOT persisted — no ERP credentials configured.`,
    );
    return created;
  }

  async getOrder(token: string): Promise<StoreOrder | null> {
    return MOCK_ORDERS.get(token) ?? null;
  }
}
