import Link from "next/link";
import { Price } from "@/components/ui/price";
import { ProductImage } from "@/components/ui/product-image";
import { StockBadge } from "@/components/ui/badge";
import { finishes } from "@/config/site";
import type { ProductCard as ProductCardType } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

/*
 * A card in the shop grid.
 *
 * The whole card is one link. Quick-add is deliberately NOT here: it needs a
 * cart, which arrives in phase 3, and a half-working add button on a grid is
 * worse than none. The hover behaviour is the second image sliding in, which is
 * the standard jewellery-site affordance and costs nothing on a phone (where
 * there is no hover and the first image simply stays).
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
    <Link
      href={`/shop/${product.slug}`}
      className={cn("group block focus:outline-none", className)}
    >
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
        <h3 className="font-display text-base leading-snug decoration-line-strong underline-offset-4 group-hover:underline">
          {product.name}
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
    </Link>
  );
}
