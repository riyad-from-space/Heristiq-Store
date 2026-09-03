"use client";

import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/ui/product-image";
import { taka, dayRange } from "@/lib/format";
import { freeDeliveryGap, type DeliveryTerms } from "@/lib/delivery";
import type { Cart } from "@/lib/cart/types";

/*
 * The order summary.
 *
 * The delivery fee shown here is computed by the same function the server uses
 * to write the order — lib/delivery.ts, deliberately free of any env import so
 * it can run in both places. A summary that disagrees with the total charged is
 * the fastest way to lose a customer's trust at the exact moment they are
 * deciding whether to give a stranger their address.
 */
export function OrderSummary({
  cart,
  subtotal,
  deliveryFee,
  insideDhaka,
  addressChosen,
  terms,
}: {
  cart: Cart;
  subtotal: number;
  deliveryFee: number;
  insideDhaka: boolean;
  /** False until a district is picked, when the fee is still a guess. */
  addressChosen: boolean;
  terms: DeliveryTerms;
}) {
  const gap = freeDeliveryGap(subtotal, terms);
  const total = subtotal + deliveryFee;
  const days = insideDhaka ? terms.insideDays : terms.outsideDays;

  return (
    <div className="border-line bg-paper border">
      <div className="p-5 sm:p-6">
        <h2 className="text-eyebrow text-ink-muted uppercase">Your order</h2>

        <ul className="mt-5 space-y-4">
          {cart.lines.map((line) => (
            <li key={line.productId} className="flex gap-3">
              <div className="w-14 shrink-0">
                <ProductImage
                  image={
                    line.imageId
                      ? { id: line.imageId, alt: line.name }
                      : undefined
                  }
                  alt={line.name}
                  sizes="56px"
                  maxWidth={320}
                  placeholderLabel={line.sku}
                />
              </div>
              <div className="flex min-w-0 flex-1 justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{line.name}</p>
                  <p className="text-ink-faint tnum mt-1 text-xs">
                    Qty {line.qty}
                  </p>
                  {line.isPreOrder && (
                    <Badge tone="sea" className="mt-1.5">
                      Pre-order
                    </Badge>
                  )}
                </div>
                <p className="tnum shrink-0 text-sm">
                  {taka((line.unitPrice ?? 0) * line.qty)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <dl className="border-line space-y-3 border-t p-5 text-sm sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <dt>Subtotal</dt>
          <dd className="tnum">{taka(subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt>
            Delivery
            {addressChosen && (
              <span className="text-ink-faint ml-1.5 text-xs">
                {insideDhaka ? "inside Dhaka" : "outside Dhaka"}
              </span>
            )}
          </dt>
          <dd className="tnum">
            {!addressChosen ? (
              <span className="text-ink-muted text-xs">Pick a district</span>
            ) : deliveryFee === 0 ? (
              <span className="text-success">Free</span>
            ) : (
              taka(deliveryFee)
            )}
          </dd>
        </div>

        {gap !== null && (
          <p className="bg-gold-wash text-gold-deep px-3 py-2 text-xs leading-relaxed">
            Add {taka(gap)} more and delivery is free.
          </p>
        )}
      </dl>

      <div className="border-line flex items-baseline justify-between gap-4 border-t p-5 sm:p-6">
        <span className="font-display text-base">Pay on delivery</span>
        <span className="font-display tnum text-xl">{taka(total)}</span>
      </div>

      {addressChosen && (
        <p className="text-ink-muted border-line border-t px-5 py-4 text-xs leading-relaxed sm:px-6">
          Arrives in {dayRange(days.min, days.max)}. Pay the courier in cash
          when it reaches you.
        </p>
      )}
    </div>
  );
}
