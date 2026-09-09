"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Price } from "@/components/ui/price";
import { DURATION, EASE } from "@/lib/motion";
import type { CartLine } from "@/lib/cart/types";

/*
 * The phone buy bar.
 *
 * The product page on a phone is: photograph, name, price, buy box, then a
 * long accordion of details, care and returns, then three related pieces.
 * Which means the customer reads everything that persuades them to buy AFTER
 * the only button that lets them, and has to scroll back up to act on it.
 * This is the standard fix, and it is worth more on this site than anywhere
 * else: the traffic arrives from Instagram on a phone and reads the details
 * because it is a first purchase from a shop it has just met.
 *
 * Phone only — `lg:hidden`. On a desktop the buy box is beside the gallery
 * and never leaves the screen, so a second one would be clutter.
 *
 * The sentinel, not a scroll offset: the bar appears when the real buy box
 * has actually left the top of the screen. A pixel threshold would be wrong
 * on every phone whose gallery is a different height, and this page's height
 * changes with the length of the product description.
 */
export function StickyBuyBar({
  line,
  preOrder,
  buyable,
  name,
  price,
  whatsappHref,
}: {
  line: Omit<CartLine, "qty">;
  preOrder: boolean;
  /** False for an unpriced piece — then there is no cart button, only WhatsApp. */
  buyable: boolean;
  name: string;
  price: number | null;
  whatsappHref: string | null;
}) {
  const { add } = useCart();
  const reduced = useReducedMotion();
  const sentinel = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;

    /*
     * `top < 0` rather than plain `!isIntersecting`, because the sentinel is
     * also not intersecting while it is still BELOW the fold — which is the
     * whole page on first paint. Without the sign check the bar would flash
     * up on load, over a buy box that is right there on screen.
     */
    const observer = new IntersectionObserver(
      ([entry]) => setPast(entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onAdd = () => {
    add(line, 1);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 3000);
  };

  const show = past && (buyable || whatsappHref !== null);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />

      <AnimatePresence>
        {show && (
          <motion.div
            /* Not `data-reveal`: this element is genuinely absent until the
               customer scrolls, so the no-JS and reduced-motion guardrails
               that force reveals visible must not touch it. Reduced motion is
               handled by skipping the offset instead. */
            initial={reduced ? { opacity: 1 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 1 } : { y: "100%" }}
            transition={{ duration: DURATION.calm, ease: EASE }}
            className="border-line bg-white/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md lg:hidden"
          >
            {/*
             * pb-[env(safe-area-inset-bottom)] keeps the button clear of the
             * iPhone home indicator, which otherwise sits on top of it and
             * swallows the tap.
             */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="min-w-0 flex-1">
                {/* The name is here because a customer who has scrolled
                    through three related pieces may no longer be sure which
                    one this bar is about. */}
                <p className="truncate text-xs font-medium">{name}</p>
                <Price amount={price} size="sm" className="mt-0.5" />
              </div>

              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ask about this piece on WhatsApp"
                  className="border-control text-ink hover:bg-sand grid size-12 shrink-0 place-items-center rounded-pill border transition-colors"
                >
                  <WhatsAppIcon size={19} />
                </a>
              )}

              {buyable && (
                <button
                  type="button"
                  onClick={onAdd}
                  className="bg-ink text-blush hover:bg-plum-2 duration-quick ease-out-soft focus-visible:outline-rose inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-pill px-5 text-sm font-medium tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:active:scale-[0.98]"
                >
                  {added ? (
                    <>
                      <Check size={16} /> Added
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={16} />
                      {preOrder ? "Pre-order" : "Add"}
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
