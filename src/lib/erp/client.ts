import type {
  CreatedOrder,
  OrderDraft,
  StoreOrder,
} from "@/lib/orders/types";
import type { Product, ProductCard, ProductQuery } from "@/lib/erp/types";

/*
 * The seam between the storefront and the ERP.
 *
 * Everything the site knows about the catalogue comes through this interface,
 * so the ERP can move — a different Supabase project, an HTTP API in front of
 * it, a different system entirely — without touching a page.
 *
 * What is deliberately NOT here: anything that writes stock. The ERP owns the
 * ledger. The storefront's job is to record what a customer asked for; turning
 * that into a stock movement is the ERP's, via post_sale(), once the parcel is
 * delivered and the cash is in.
 */

export type StockLevel = {
  productId: string;
  /** Units physically on hand. */
  onHand: number;
  /** Claimed by open pre-orders. */
  reserved: number;
  /** onHand - reserved. What is actually free to promise. */
  available: number;
};

export interface ErpClient {
  /** The shop grid. Sorted and filtered server-side. */
  getProducts(query?: ProductQuery): Promise<ProductCard[]>;

  /** One product by its slug, for the PDP. null when there is no such slug. */
  getProduct(slug: string): Promise<Product | null>;

  /**
   * Products by id, in one read.
   *
   * This is what re-prices a cart. A cart line carries a price snapshot from
   * whenever it was added, which may be hours or a phone reboot ago, so the
   * only number allowed near an order total is the one this returns. Ids that
   * no longer exist are simply absent from the result — the caller has to
   * handle a missing line either way.
   */
  getProductsByIds(productIds: string[]): Promise<ProductCard[]>;

  /** Fresh stock for a set of products — used to re-check a cart at checkout. */
  getStock(productIds: string[]): Promise<StockLevel[]>;

  /**
   * Record a customer order.
   *
   * Returns as soon as the order is durable. Pushing it to the courier and
   * posting it as an ERP sale are separate, later steps, because a customer
   * must never wait on a third-party API to see a confirmation page — and
   * because an order that exists is recoverable while one that timed out
   * mid-write is not.
   */
  createOrder(draft: OrderDraft): Promise<CreatedOrder>;

  /** One order by its public token, for the confirmation page. */
  getOrder(token: string): Promise<StoreOrder | null>;

  /** Which implementation answered — surfaced in the admin footer, not to customers. */
  readonly source: "erp" | "mock";
}
