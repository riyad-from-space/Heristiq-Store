import Link from "next/link";
import { QuickAdd } from "@/components/cart/quick-add";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { StockBadge } from "@/components/ui/badge";
import { finishes } from "@/config/site";
import { cartLineFor } from "@/lib/cart/line";
import { isBuyable } from "@/lib/erp/types";
import type { ProductCard as ProductCardType } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

/*
 * A card in the shop grid.
 *
 * The card is a <div> with a stretched link over it rather than one big <a>,
 * because quick-add is a button and a button inside a link is invalid markup
 * that browsers resolve by guessing. The overlay pattern keeps one large tap
 * target for "open the piece" while leaving room for a real control on top.
 *
 * The hover behaviour is the second image crossfading in, the standard
 * jewellery-site affordance, which costs nothing on a phone where there is no
 * hover and the first image simply stays.
 */
export function ProductCardTile({
  product,
  priority = false,
  className,
}: {
  product: ProductCardType;
  priority?: boolean;
  className?: string;
}) {
  const [hero, second] = product.images;
  const finish = product.finish ? finishes[product.finish] : null;

  return (
    <div className={cn("group relative", className)}>
      <div className="relative">
        <ProductImage
          image={hero}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          priority={priority}
          maxWidth={828}
          placeholderLabel={product.sku}
          className={cn(
            "transition-opacity duration-500",
            second && "group-hover:opacity-0",
          )}
        />
        {second && (
          <ProductImage
            image={second}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            maxWidth={828}
            className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}

        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          <StockBadge availability={product.availability} />
        </div>

        {/* The focus ring goes on the image, not the whole card, so keyboard
            focus lands somewhere visible without outlining the text too. */}
        <span className="pointer-events-none absolute inset-0 ring-gold transition group-focus-visible:ring-2 group-focus-visible:ring-offset-2" />

        {isBuyable(product) && (
          <QuickAdd
            line={cartLineFor(product)}
            preOrder={product.availability.state === "pre_order"}
            className="absolute right-2 bottom-2"
          />
        )}
      </div>

      {/*
       * Name above, then price and finish on one line beneath it.
       *
       * The price was beside the name, which reads well at ৳250 but collapses
       * on the two-column phone grid the moment the string is long — an
       * unpriced piece renders "Price on request" and squeezed the title into
       * a four-line column one word wide. Stacking is immune to the length of
       * either, and every price on the site is currently one of those two
       * shapes.
       */}
      <div className="pt-4">
        <h3 className="font-display text-base leading-snug">
          {/* The stretched link. Everything in the card except quick-add is
              inside its hit area, and the accessible name is the piece. */}
          <Link
            href={`/shop/${product.slug}`}
            className="decoration-line-strong underline-offset-4 before:absolute before:inset-0 before:z-10 focus:outline-none group-hover:underline"
          >
            {product.name}
          </Link>
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Price
            amount={product.price}
            compareAt={product.compareAtPrice}
            size="sm"
          />
          {finish && (
            <span className="text-ink-muted flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="border-line-strong inline-block size-2.5 rounded-full border"
                style={{ background: finish.swatch }}
              />
              {finish.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
