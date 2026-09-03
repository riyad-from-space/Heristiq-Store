import Link from "next/link";
import { MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { dayRange, taka } from "@/lib/format";
import { whatsappNumber } from "@/lib/phone";
import { deliveryTerms } from "@/lib/delivery";
import type { Product } from "@/lib/erp/types";
import { isBuyable, isPreOrder } from "@/lib/erp/types";

/*
 * The buy box.
 *
 * Phase 2 has no cart, so the primary action is a pre-filled WhatsApp message —
 * which is not a placeholder, it is how this business already takes orders. It
 * works today, on the phone the customer is already holding.
 *
 * Phase 3 replaces this with add-to-cart and demotes WhatsApp to "ask about
 * this piece". Everything else in this component — the price, the stock state,
 * the delivery promise, the COD note — stays exactly as it is.
 *
 * Three states it has to get right:
 *   priced + available  → order it
 *   priced + sold out   → pre-order it, clearly labelled
 *   unpriced            → no order button at all, and say why
 */
export function BuyBox({ product, url }: { product: Product; url: string }) {
  const terms = deliveryTerms();
  const preOrder = isPreOrder(product);
  const buyable = isBuyable(product);
  const wa = whatsappNumber(site.contact.phone);

  const message = [
    `Hi Heristiq, I'd like to order:`,
    ``,
    `${product.name} (${product.sku})`,
    product.price !== null ? `Price: ${taka(product.price)}` : `Price: please confirm`,
    preOrder ? `This one is sold out — happy to pre-order.` : ``,
    ``,
    url,
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");

  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="mt-8">
      {!buyable && product.price === null && (
        <p className="border-line bg-shell text-ink-muted mb-5 border px-4 py-3 text-sm">
          This piece is not priced yet. Message us and we will confirm the price
          and reserve one for you.
        </p>
      )}

      {preOrder && (
        <div className="border-sea/20 bg-sea/5 mb-5 border px-4 py-3">
          <p className="text-sm font-medium">Sold out — available to pre-order</p>
          <p className="text-ink-muted mt-1 text-sm leading-relaxed">
            Pay a small advance now and the balance to the courier on delivery.
            Restocks usually land within 2–3 weeks; we will confirm the date
            before taking anything.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {waHref && (
          <Button asChild size="lg" variant={preOrder ? "secondary" : "primary"}>
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon size={18} />
              {preOrder ? "Pre-order on WhatsApp" : "Order on WhatsApp"}
            </a>
          </Button>
        )}
        <Button asChild size="lg" variant="secondary">
          <Link href="/contact">
            <MessageCircle size={17} />
            Ask about this piece
          </Link>
        </Button>
      </div>

      <dl className="border-line mt-8 space-y-4 border-t pt-6 text-sm">
        <div className="flex gap-3">
          <Truck size={17} className="text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
          <div>
            <dt className="font-medium">Delivery</dt>
            <dd className="text-ink-muted mt-1 leading-relaxed">
              Inside Dhaka {dayRange(terms.insideDays.min, terms.insideDays.max)} ·{" "}
              {taka(terms.insideDhakaFee)}. Outside Dhaka{" "}
              {dayRange(terms.outsideDays.min, terms.outsideDays.max)} ·{" "}
              {taka(terms.outsideDhakaFee)}.
              {terms.freeThreshold > 0 && (
                <> Free over {taka(terms.freeThreshold)}.</>
              )}
            </dd>
          </div>
        </div>

        <div className="flex gap-3">
          <ShieldCheck
            size={17}
            className="text-gold mt-0.5 shrink-0"
            strokeWidth={1.6}
          />
          <div>
            <dt className="font-medium">Cash on delivery</dt>
            <dd className="text-ink-muted mt-1 leading-relaxed">
              {preOrder
                ? "Advance by bKash or Nagad, balance in cash to the courier."
                : "Pay the courier in cash when it reaches you. No advance."}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
