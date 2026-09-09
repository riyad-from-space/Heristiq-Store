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
      {/*
       * The zoom lives on this wrapper, not on either <ProductImage>, and
       * `overflow-hidden` is why: scaling the image inside a clipping box
       * makes it grow into the frame. Scaling the images themselves would
       * push them past the card's edges and over the neighbouring cell.
       *
       * Motion here is CSS rather than `motion`, deliberately. A hover zoom
       * is a two-state transition with no orchestration, so it needs no
       * JavaScript at all — and this component renders up to nine times on
       * the shop grid, where nine more client components would be the most
       * expensive animation on the site for the least gain.
       */}
      <div className="relative overflow-hidden">
        <div className="ease-out-soft transition-transform duration-slow motion-safe:group-hover:scale-[1.04]">
          <ProductImage
            image={hero}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            priority={priority}
            maxWidth={828}
            placeholderLabel={product.sku}
            className={cn(
              "duration-calm transition-opacity",
              second && "group-hover:opacity-0",
            )}
          />
          {second && (
            <ProductImage
              image={second}
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
              maxWidth={828}
              className="duration-calm absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
            />
          )}
        </div>

        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          <StockBadge availability={product.availability} />
        </div>

        {/*
         * The focus ring goes on the image, not the whole card, so keyboard
         * focus lands somewhere visible without outlining the text too.
         *
         * `ring-inset` rather than `ring-offset-2`: the zoom above needs
         * `overflow-hidden` on the parent, which clips anything drawn outside
         * this span's box — an offset ring would have been cropped on all
         * four sides and the keyboard user would have lost the focus
         * indicator the ring exists to provide. Inset draws it inward, where
         * nothing can clip it.
         */}
        <span className="ring-rose pointer-events-none absolute inset-0 transition group-focus-visible:ring-2 group-focus-visible:ring-inset" />

        {/*
         * Quick add. On a mouse it slides up on hover; on a touch screen it
         * is simply always there.
         *
         * That split is `pointer-fine:` / `pointer-coarse:` rather than
         * `hover:` alone, and it matters: a phone has no hover, so
         * hover-to-reveal on a touch device means the button is permanently
         * invisible — or worse, appears after a tap that the browser
         * synthesises as a hover, so the customer's first tap reveals the
         * button and their second one presses it. Gating on the input device
         * instead of the interaction is the only version that works on both.
         *
         * `focus-within:` brings it back for keyboard users, who have no
         * pointer of either kind.
         */}
        {isBuyable(product) && (
          <QuickAdd
            line={cartLineFor(product)}
            preOrder={product.availability.state === "pre_order"}
            className={cn(
              "absolute right-2 bottom-2",
              "duration-calm ease-out-soft transition-[opacity,translate]",
              "pointer-fine:translate-y-1 pointer-fine:opacity-0",
              "pointer-fine:group-hover:translate-y-0 pointer-fine:group-hover:opacity-100",
              "pointer-fine:group-focus-within:translate-y-0 pointer-fine:group-focus-within:opacity-100",
            )}
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
            <span className="text-stone flex items-center gap-1.5 text-xs">
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
