import type { CartLine } from "@/lib/cart/types";
import { isPreOrder, type Product, type ProductCard } from "@/lib/erp/types";

/*
 * Product → cart line.
 *
 * One function so the grid's quick-add and the PDP's add-to-cart cannot produce
 * differently-shaped lines for the same piece — which would show up as a
 * duplicate row in the cart rather than a quantity of two.
 *
 * Called on the server, in the component that already has the ERP read, so the
 * price snapshot is the one the customer was shown on that render.
 */
export function cartLineFor(
  product: Product | ProductCard,
): Omit<CartLine, "qty"> {
  return {
    productId: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    imageId: product.images[0]?.id ?? null,
    unitPrice: product.price,
    isPreOrder: isPreOrder(product),
  };
}
