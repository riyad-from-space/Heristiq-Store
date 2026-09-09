"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import type { CartLine } from "@/lib/cart/types";
import { cn } from "@/lib/utils";

/*
 * Quick-add on a shop-grid card.
 *
 * Visibility is decided by the CARD (see product-card.tsx), and the rule there
 * is worth restating because it used to live here: always visible on a touch
 * screen, hover-revealed only where there is a real mouse. This comment
 * previously said "always visible, not hover-revealed" on the grounds that 85%
 * of traffic has no hover — which is still the reason, but the conclusion is
 * now expressed as `pointer-coarse` / `pointer-fine` rather than as never
 * hiding it. A phone still shows the button permanently; a desktop gets the
 * cleaner card and reveals it under the cursor.
 *
 * It sits ABOVE the card's link overlay in the stacking order and stops the
 * click from propagating, so tapping it adds the piece instead of navigating.
 * The confirmation is the check plus the header's cart count going up — a
 * toast per tap on a grid where people add three things is noise.
 */
export function QuickAdd({
  line,
  preOrder,
  className,
}: {
  line: Omit<CartLine, "qty">;
  preOrder: boolean;
  className?: string;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        add(line, 1);
        setAdded(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setAdded(false), 1800);
      }}
      aria-label={
        added
          ? `${line.name} added to cart`
          : preOrder
            ? `Pre-order ${line.name}`
            : `Add ${line.name} to cart`
      }
      className={cn(
        "bg-white/95 text-ink border-line hover:border-ink z-20 inline-flex min-h-9 items-center gap-1.5 border px-3 text-xs backdrop-blur-sm transition-colors",
        className,
      )}
    >
      {added ? (
        <>
          <Check size={14} className="text-success" />
          Added
        </>
      ) : (
        <>
          <Plus size={14} />
          {preOrder ? "Pre-order" : "Add"}
        </>
      )}
    </button>
  );
}
