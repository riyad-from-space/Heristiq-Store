import { site } from "@/config/site";
import { taka } from "@/lib/format";
import { whatsappNumber } from "@/lib/phone";
import type { Product } from "@/lib/erp/types";
import { isPreOrder } from "@/lib/erp/types";

/**
 * The "ask about this piece" WhatsApp link.
 *
 * Extracted because two components now need it — the buy box and the phone
 * sticky bar — and a customer who taps one and then the other must not get
 * two differently-worded messages about the same piece. It also keeps the
 * message text in one place to translate or reword later.
 *
 * Returns null when no usable number is configured, and both callers hide
 * their WhatsApp affordance in that case rather than rendering a dead link.
 */
export function productEnquiryHref(product: Product, url: string) {
  const number = whatsappNumber(site.contact.phone);
  if (!number) return null;

  const message = [
    `Hi Heristiq, I have a question about:`,
    ``,
    `${product.name} (${product.sku})`,
    product.price !== null
      ? `Price: ${taka(product.price)}`
      : `Price: please confirm`,
    isPreOrder(product) ? `This one is sold out — is a pre-order possible?` : ``,
    ``,
    url,
  ]
    /* Collapse the blank line that an absent pre-order line leaves behind. */
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
