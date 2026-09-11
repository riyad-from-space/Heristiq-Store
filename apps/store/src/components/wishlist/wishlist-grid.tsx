"use client";

import Link from "next/link";
import { ProductCardTile } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import type { ProductCard } from "@/lib/erp/types";

/*
 * The saved-pieces grid.
 *
 * The whole catalogue is fetched on the SERVER and handed down; this filters
 * it against the ids in localStorage. That split is deliberate:
 *
 *   - the wishlist only exists in the browser, so the server cannot know
 *     which pieces to fetch;
 *   - but the browser must not be the source of truth for a price. Saving an
 *     id and re-reading the piece from the catalogue means a saved item shows
 *     today's price and today's stock, and a piece that has since sold out
 *     says so. Caching the product itself in localStorage would have shown a
 *     stale price weeks later, which is the kind of thing that turns into a
 *     refund conversation.
 *
 * Seven products makes fetching all of them cheaper than any per-id endpoint.
 * If the catalogue grows past a couple of hundred this should become an ids
 * query — `getProductsByIds` already exists on the ERP client for it.
 */
export function WishlistGrid({ products }: { products: ProductCard[] }) {
  const { ids, ready } = useWishlist();

  /* Until localStorage has been read there is nothing honest to show: an
     empty state would flash "nothing saved" at someone who has saved six
     things. Skeletons hold the space instead. */
  if (!ready) {
    return (
      <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <ProductCardSkeleton key={n} />
        ))}
      </div>
    );
  }

  /* Ordered by when they were saved, newest first — `ids` already is, so this
     preserves that rather than falling back to catalogue order. */
  const saved = ids
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is ProductCard => p !== undefined);

  if (saved.length === 0) {
    return (
      <div className="border-line rounded-card mt-9 border border-dashed px-6 py-14 text-center">
        <p className="font-display text-display-s">Nothing saved yet</p>
        <p className="text-copy text-stone mx-auto mt-2 max-w-sm">
          Tap the heart on any piece and it will wait for you here.
        </p>
        <Button asChild size="lg" className="mt-7">
          <Link href="/shop">Browse the collection</Link>
        </Button>
      </div>
    );
  }

  /*
   * A piece can be saved and then removed from sale. `find` returning nothing
   * is exactly that case, and it is filtered out above rather than rendered
   * as a gap — but the count below is the SAVED count, so a customer whose
   * heart count says 4 and whose grid shows 3 gets told why.
   */
  const missing = ids.length - saved.length;

  return (
    <>
      <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 lg:grid-cols-4">
        {saved.map((product) => (
          <ProductCardTile
            key={product.id}
            product={product}
            /* 2 columns on a phone, 4 from lg. */
            sizes="(min-width: 1024px) 23vw, 45vw"
          />
        ))}
      </div>
      {missing > 0 && (
        <p className="text-copy-sm text-stone mt-8">
          {missing === 1
            ? "One saved piece is no longer available and is not shown."
            : `${missing} saved pieces are no longer available and are not shown.`}
        </p>
      )}
    </>
  );
}
