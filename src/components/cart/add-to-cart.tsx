"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { MAX_QTY, type CartLine } from "@/lib/cart/types";

/*
 * Add to cart, with a quantity stepper.
 *
 * The line is passed in already built by the server component that renders
 * this, so the client never has to know how a Product becomes a CartLine — and
 * the price snapshot in it comes from the ERP read that rendered the page, not
 * from anything the browser computed.
 *
 * After adding, the button becomes a link to the cart for four seconds. That
 * beats a toast here: the customer's next action is either "add another" or
 * "go to cart", and this offers the second without hiding the first.
 */
export function AddToCart({
  line,
  preOrder,
  className,
}: {
  line: Omit<CartLine, "qty">;
  preOrder: boolean;
  className?: string;
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* A pending timeout that fires after the customer has navigated away would
     set state on an unmounted component. */
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onAdd = () => {
    add(line, qty);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 4000);
  };

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div
          className="border-line-strong flex items-center justify-between border sm:w-32"
          role="group"
          aria-label="Quantity"
        >
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Reduce quantity"
            className="grid size-12 place-items-center disabled:opacity-30"
          >
            <Minus size={15} />
          </button>
          <span aria-live="polite" className="tnum text-sm">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
            disabled={qty >= MAX_QTY}
            aria-label="Increase quantity"
            className="grid size-12 place-items-center disabled:opacity-30"
          >
            <Plus size={15} />
          </button>
        </div>

        {added ? (
          <Button asChild size="lg" variant="secondary" className="flex-1">
            <Link href="/cart">
              <Check size={17} className="text-success" />
              Added — view cart
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={onAdd}
            variant={preOrder ? "secondary" : "primary"}
            className="flex-1"
          >
            <ShoppingBag size={17} />
            {preOrder ? "Pre-order this piece" : "Add to cart"}
          </Button>
        )}
      </div>
    </div>
  );
}
