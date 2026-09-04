import type { FinishKey, MotifKey } from "@/config/site";

/*
 * The storefront's view of a product.
 *
 * This is NOT the ERP's product row. The ERP row carries avg_cost, unit_margin,
 * supplier and stock_value — none of which may reach a customer. The mapping in
 * lib/erp/supabase.ts is the only place that crosses that line, and it drops
 * every cost field on the way through.
 *
 * Two other deliberate shapes:
 *  - `price` is nullable. Retail prices are not set yet, and "0" is a real price
 *    the ERP stores for "not decided". Rendering ৳0 would be a lie, so a missing
 *    price is null here and the UI shows "Price on request".
 *  - Stock is an availability STATE, not a number, everywhere except low stock.
 *    A customer needs to know whether they can buy it; the exact count is the
 *    ERP's business and leaks how small the operation is.
 */

export type Availability =
  | { state: "in_stock" }
  /** Show the count: scarcity is honest here and it converts. */
  | { state: "low_stock"; left: number }
  /** Nothing free to promise, so the buy button becomes a pre-order. */
  | { state: "pre_order" }
  /** Deliberately not for sale — discontinued, or held back. */
  | { state: "unavailable" };

export type ProductImage = {
  /** A Cloudinary public ID, e.g. "wc-005/front". Never a full URL. */
  id: string;
  alt: string;
};

export type Product = {
  /** ERP products.id (uuid). The join key back to inventory. */
  id: string;
  sku: string;
  /** Permalink. Stable even if the display name is edited. */
  slug: string;
  name: string;
  /** Short, editorial. One or two sentences. */
  tagline: string | null;
  description: string | null;
  /** null = not priced yet. Never render this as zero. */
  price: number | null;
  /** Was-price for a markdown, if any. Always > price when present. */
  compareAtPrice: number | null;
  finish: FinishKey | null;
  motif: MotifKey | null;
  images: ProductImage[];
  availability: Availability;
  /** Length in inches, as a range the chain adjusts across. */
  lengthInches: { min: number; max: number } | null;
  materials: string | null;
  featured: boolean;
  /** Merchandising order. Lower sorts first. */
  position: number;
};

/** What the shop grid needs — a Product minus the PDP-only prose. */
export type ProductCard = Pick<
  Product,
  | "id"
  | "sku"
  | "slug"
  | "name"
  | "price"
  | "compareAtPrice"
  | "finish"
  | "motif"
  | "images"
  | "availability"
  | "featured"
>;

export type ProductQuery = {
  finish?: FinishKey;
  motif?: MotifKey;
  sort?: SortKey;
  /** Include products with no free stock. Default true — they can be pre-ordered. */
  includeOutOfStock?: boolean;
};

export const SORTS = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
} as const;

export type SortKey = keyof typeof SORTS;

/** True when the customer can put this in a cart at all. */
export function isBuyable(product: Pick<Product, "price" | "availability">) {
  if (product.price === null) return false;
  return product.availability.state !== "unavailable";
}

/** True when adding it creates a pre-order rather than a normal line. */
export function isPreOrder(product: Pick<Product, "availability">) {
  return product.availability.state === "pre_order";
}

export function availabilityLabel(availability: Availability): string {
  switch (availability.state) {
    case "in_stock":
      return "In stock";
    case "low_stock":
      return availability.left === 1
        ? "Last one"
        : `Only ${availability.left} left`;
    case "pre_order":
      return "Pre-order";
    case "unavailable":
      return "Unavailable";
  }
}
