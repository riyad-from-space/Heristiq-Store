import Link from "next/link";
import { QuickAdd } from "@/components/cart/quick-add";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { StockBadge } from "@/components/ui/badge";
import { SaveButton } from "@/components/wishlist/save-button";
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
  feature = false,
  sizes,
  className,
}: {
  product: ProductCardType;
  priority?: boolean;
  /**
   * How wide this card renders, per breakpoint — the caller's job, because
   * only the caller knows its own grid.
   *
   * This used to be hardcoded here as
   *   (min-width: 1024px) 23vw, (min-width: 640px) 45vw, 92vw
   * and that single string had to serve three different layouts: the home
   * page's phone rail (74vw), the home page's desktop grid (2 then 4
   * columns), and the shop's grid (2 then 3). It was wrong for most of them.
   *
   * Measured on the live site before this changed: a shop card renders at
   * 43vw on a 390px phone, but `sizes` promised 92vw — so the browser, at
   * DPR 2, asked for w_828 when w_390 would do. Eight cards, 1,758 KB
   * instead of about 320 KB, on the page a customer from Instagram lands on
   * with the slowest connection.
   *
   * `sizes` is a PROMISE to the browser, and it picks from srcset before
   * layout exists, so it cannot check. An over-promise wastes bandwidth
   * silently; an under-promise ships a blurry image. Neither shows up in any
   * test that only asks whether the image loaded.
   */
  sizes: string;
  /**
   * The mockup's first card, spanning two columns and running taller.
   *
   * It changes the media's shape rather than the card's contents: a feature
   * card is the same product, given more room. Everything below the image is
   * identical, which is what keeps a row of mixed sizes reading as one grid.
   */
  feature?: boolean;
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
      <div className="rounded-card relative overflow-hidden">
        <div className="ease-out-soft transition-transform duration-slow motion-safe:group-hover:scale-[1.04]">
          <ProductImage
            image={hero}
            sizes={sizes}
            priority={priority}
            maxWidth={feature ? 1080 : 828}
            placeholderLabel={product.sku}
            className={cn(
              "duration-calm transition-opacity",
              feature ? "aspect-4/3 sm:aspect-16/11" : "aspect-[3/3.6]",
              second && "group-hover:opacity-0",
            )}
          />
          {second && (
            <ProductImage
              image={second}
              sizes={sizes}
              maxWidth={feature ? 1080 : 828}
              className="duration-calm absolute inset-0 h-full opacity-0 transition-opacity group-hover:opacity-100"
            />
          )}
        </div>

        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          <StockBadge availability={product.availability} />
        </div>

        <SaveButton
          productId={product.id}
          name={product.name}
          className="absolute top-3 right-3"
        />

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
        <span className="ring-rose rounded-card pointer-events-none absolute inset-0 transition group-focus-visible:ring-2 group-focus-visible:ring-inset" />

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
      <div className="flex items-baseline justify-between gap-3 pt-3">
        <div className="min-w-0">
        <h3 className="text-[0.98rem] leading-snug font-semibold">
          {/* The stretched link. Everything in the card except quick-add is
              inside its hit area, and the accessible name is the piece. */}
          <Link
            href={`/shop/${product.slug}`}
            className="decoration-line-strong underline-offset-4 before:absolute before:inset-0 before:z-10 focus:outline-none group-hover:underline"
          >
            {product.name}
          </Link>
        </h3>
        {finish && (
          <span className="text-copy-xs text-stone mt-0.5 flex items-center gap-1.5">
            <span
              aria-hidden
              /* The finish swatch is a literal product colour and stays out
                 of the palette — gold is gold whatever the page looks like. */
              className="border-line-strong inline-block size-2.5 shrink-0 rounded-full border"
              style={{ background: finish.swatch }}
            />
            {finish.label}
          </span>
        )}
        </div>
        {/* The price is its own column so a long name wraps beside it rather
            than pushing it onto a second line — the two-column phone grid is
            narrow enough that this happens with the shortest of names. */}
        <Price
          amount={product.price}
          compareAt={product.compareAtPrice}
          size="sm"
          className="shrink-0"
        />
      </div>
    </div>
  );
}
