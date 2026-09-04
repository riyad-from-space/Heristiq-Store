/*
 * The cart.
 *
 * Everything in a cart line is a SNAPSHOT for display, including the price. The
 * server never trusts any of it: lib/orders/place.ts re-reads every product
 * from the ERP and recomputes the total from those numbers before an order is
 * written. A customer who edits localStorage gets the real price, and a
 * customer whose cart sat open for a week while the price changed gets told
 * rather than charged the old one.
 *
 * So the only field the server actually consumes is productId and qty. The rest
 * exists so /cart can render without a round trip per line.
 */
export type CartLine = {
  productId: string;
  sku: string;
  slug: string;
  name: string;
  /** Cloudinary public id of the hero shot, or null if unphotographed. */
  imageId: string | null;
  /** Snapshot, for display only. Null means it was unpriced when added. */
  unitPrice: number | null;
  qty: number;
  /** True when this line was a sold-out piece added as a pre-order. */
  isPreOrder: boolean;
};

export type Cart = {
  lines: CartLine[];
};

export const EMPTY_CART: Cart = { lines: [] };

/** Max per line. Not a stock check — that is the server's job at checkout. */
export const MAX_QTY = 10;

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.qty, 0);
}

/**
 * Subtotal from the snapshots, for the header and the cart page.
 *
 * Unpriced lines contribute nothing rather than blocking the sum — the cart
 * page labels them and checkout refuses to accept them, which is a clearer
 * place to stop someone than a total that will not render.
 */
export function cartSubtotal(cart: Cart): number {
  return cart.lines.reduce(
    (sum, line) => sum + (line.unitPrice ?? 0) * line.qty,
    0,
  );
}

export function hasUnpricedLine(cart: Cart): boolean {
  return cart.lines.some((line) => line.unitPrice === null);
}

export function hasPreOrderLine(cart: Cart): boolean {
  return cart.lines.some((line) => line.isPreOrder);
}
