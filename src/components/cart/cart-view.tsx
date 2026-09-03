"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { Badge } from "@/components/ui/badge";
import { freeDeliveryGap, type DeliveryTerms } from "@/lib/delivery";
import { hasUnpricedLine, MAX_QTY, type CartLine } from "@/lib/cart/types";
import { taka } from "@/lib/format";

/*
 * The cart.
 *
 * Delivery is NOT priced here, and that is a deliberate omission rather than a
 * shortcut: the fee depends on the district, which the customer has not given
 * yet, and showing ৳70 that becomes ৳130 one screen later is the kind of small
 * surprise that loses an order. So the cart states the subtotal and says where
 * the fee is decided.
 *
 * `terms` arrives as a prop because the numbers behind it are server config —
 * see lib/delivery.ts for why the arithmetic is client-side but the numbers
 * are not.
 */
export function CartView({ terms }: { terms: DeliveryTerms }) {
  const { cart, ready, subtotal, setQty, remove } = useCart();

  /* Until localStorage has been read there is no honest thing to render: an
     empty state would flash for anyone who has a cart. */
  if (!ready) {
    return <div className="min-h-[40vh]" aria-busy="true" />;
  }

  if (cart.lines.length === 0) return <EmptyCart />;

  const unpriced = hasUnpricedLine(cart);
  const gap = freeDeliveryGap(subtotal, terms);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <ul className="border-line border-t">
        {cart.lines.map((line) => (
          <CartLineRow
            key={line.productId}
            line={line}
            onQty={(qty) => setQty(line.productId, qty)}
            onRemove={() => remove(line.productId)}
          />
        ))}
      </ul>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="border-line bg-paper border p-5 sm:p-6">
          <h2 className="text-eyebrow text-ink-muted uppercase">Summary</h2>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt>Subtotal</dt>
              <dd className="tnum">{taka(subtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt>Delivery</dt>
              <dd className="text-ink-muted">
                {gap === null && terms.freeThreshold > 0
                  ? "Free"
                  : "At checkout"}
              </dd>
            </div>
          </dl>

          {gap !== null && (
            <p className="bg-gold-wash text-gold-deep mt-5 px-3 py-2.5 text-xs leading-relaxed">
              Add {taka(gap)} more for free delivery.
            </p>
          )}

          {unpriced && (
            <p className="border-warn/30 text-warn mt-5 border px-3 py-2.5 text-xs leading-relaxed">
              One piece in your cart is not priced yet. Remove it to check out,
              or message us and we will confirm the price.
            </p>
          )}

          <Button
            asChild={!unpriced}
            size="lg"
            className="mt-6 w-full"
            disabled={unpriced}
          >
            {unpriced ? (
              <span>Checkout</span>
            ) : (
              <Link href="/checkout">Checkout</Link>
            )}
          </Button>

          <p className="text-ink-muted mt-4 text-center text-xs leading-relaxed">
            Cash on delivery · {terms.insideDays.min}–{terms.outsideDays.max}{" "}
            days
            {terms.freeThreshold > 0 && (
              <> · free over {taka(terms.freeThreshold)}</>
            )}
          </p>
        </div>

        <Link
          href="/shop"
          className="text-eyebrow text-ink-muted mt-6 block text-center uppercase underline decoration-1 underline-offset-8 hover:decoration-gold"
        >
          Keep shopping
        </Link>
      </aside>
    </div>
  );
}

function CartLineRow({
  line,
  onQty,
  onRemove,
}: {
  line: CartLine;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="border-line flex gap-4 border-b py-5 sm:gap-6">
      <Link href={`/shop/${line.slug}`} className="w-20 shrink-0 sm:w-24">
        <ProductImage
          image={line.imageId ? { id: line.imageId, alt: line.name } : undefined}
          alt={line.name}
          sizes="96px"
          maxWidth={320}
          placeholderLabel={line.sku}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-base leading-snug">
              <Link href={`/shop/${line.slug}`} className="hover:underline">
                {line.name}
              </Link>
            </h3>
            <p className="text-ink-faint mt-1 text-xs">{line.sku}</p>
            {line.isPreOrder && (
              <Badge tone="sea" className="mt-2">
                Pre-order
              </Badge>
            )}
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.name}`}
            className="text-ink-faint hover:text-danger -mt-2 -mr-2 grid size-10 shrink-0 place-items-center transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div
            className="border-line-strong flex items-center border"
            role="group"
            aria-label={`Quantity of ${line.name}`}
          >
            <button
              type="button"
              onClick={() => onQty(line.qty - 1)}
              /* At one, minus removes the line — see the provider. The label
                 says so, because a minus that deletes without warning is a
                 surprise. */
              aria-label={line.qty === 1 ? "Remove" : "Reduce quantity"}
              className="grid size-10 place-items-center"
            >
              <Minus size={14} />
            </button>
            <span className="tnum w-8 text-center text-sm">{line.qty}</span>
            <button
              type="button"
              onClick={() => onQty(line.qty + 1)}
              disabled={line.qty >= MAX_QTY}
              aria-label="Increase quantity"
              className="grid size-10 place-items-center disabled:opacity-30"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="text-right">
            <Price
              amount={line.unitPrice === null ? null : line.unitPrice * line.qty}
              size="sm"
            />
            {line.qty > 1 && line.unitPrice !== null && (
              <p className="text-ink-faint tnum mt-1 text-xs">
                {taka(line.unitPrice)} each
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyCart() {
  return (
    <div className="border-line flex flex-col items-center border border-dashed px-6 py-20 text-center">
      <ShoppingBag size={24} className="text-ink-faint" strokeWidth={1.4} />
      <p className="font-display mt-5 text-display-s">Your cart is empty</p>
      <p className="text-ink-muted mt-2 max-w-xs text-sm leading-relaxed">
        Seven pieces in gold and silver, all of them cash on delivery.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/shop">Shop waist chains</Link>
      </Button>
    </div>
  );
}
