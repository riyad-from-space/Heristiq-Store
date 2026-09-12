import Link from "next/link";
import { ProductImage } from "@/components/ui/product-image";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import { categoryCovers } from "@/config/site";
import type { Category, ProductCard } from "@/lib/erp/types";

/*
 * "Shop by category" — the way into the five parts of the catalogue.
 *
 * Visually the same tile as "Shop by mood" below it: same portrait ratio, same
 * hover scale, same gradient-to-transparent label so white text stays legible
 * over a photograph whose brightness nobody can predict. Two tile rows on one
 * page that looked different would read as two different websites.
 *
 * ---------------------------------------------------------------------------
 * Where the difference from Collections is, and why
 *
 * Collections HIDES a mood with nothing in it, because a mood is a
 * merchandising idea — a tile promising "Everyday" that leads to an empty grid
 * is a broken promise, and dropping it costs nothing.
 *
 * Categories are the opposite: they are the shop's structure, and four of the
 * five are empty until the pieces are photographed. Hiding the empty ones
 * would mean the shop silently claims to sell only waist chains — which is
 * the thing this whole change exists to fix. So every active category is
 * shown, empty or not, and an empty one leads to a page that says when it is
 * coming and offers WhatsApp.
 *
 * The tile illustrates itself from the first photograph in the category, so
 * it needs no separate artwork. With no products it falls back to the designed
 * placeholder, and the gradient is hashed from the SLUG — which means each
 * category gets its own stable tint rather than five identical blocks, with no
 * per-category art direction to maintain.
 */
export function CategoryTiles({
  categories,
  products,
}: {
  categories: Category[];
  /** The whole catalogue. Used only to find a cover photo per category. */
  products: ProductCard[];
}) {
  if (categories.length === 0) return null;

  const tiles = categories.map((category) => ({
    ...category,
    /*
     * The category's own cover, then the first product in it, then the
     * designed placeholder.
     *
     * Borrowing a product photograph was the old behaviour and it has two
     * faults: the tile changes whenever the catalogue re-sorts, and it shows
     * ONE piece as though it were the whole category. A cover is shot for the
     * job — a spread, in its own setting. The fallback stays so a category
     * added tomorrow still has a tile tonight.
     */
    cover:
      categoryCovers[category.slug] ??
      products.find((p) => p.category?.slug === category.slug)?.images[0],
    count: products.filter((p) => p.category?.slug === category.slug).length,
  }));

  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow="Categories"
          title="Shop by category"
          lede="Five ways to wear Heristiq. More arriving as we photograph them."
        />
      </Container>

      {/*
       * A snap rail on a phone and a grid on desktop, matching ProductGrid on
       * this same page.
       *
       * The rail is not only about scroll length: five tiles in a
       * two-column grid leaves a lone orphan on the third row, and it would
       * get worse — six categories, seven — as the shop grows. A rail holds
       * any number without a ragged edge.
       */}
      <div className="mt-8">
        <div className="scrollbar-none px-gutter scroll-pl-gutter flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:hidden">
          {tiles.map((tile) => (
            <div key={tile.slug} className="w-[44vw] shrink-0 snap-start">
              <CategoryTile tile={tile} sizes="44vw" />
            </div>
          ))}
        </div>

        <Container className="hidden sm:block">
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-5">
            {tiles.map((tile) => (
              <CategoryTile
                key={tile.slug}
                tile={tile}
                sizes="(min-width: 1024px) 19vw, 31vw"
              />
            ))}
          </div>
        </Container>
      </div>
    </Section>
  );
}

function CategoryTile({
  tile,
  sizes,
}: {
  tile: Category & { cover?: { id: string; alt: string }; count: number };
  sizes: string;
}) {
  return (
    <Link
      href={`/shop/${tile.slug}`}
      className="group rounded-card focus-visible:outline-rose relative block aspect-[3/3.7] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <ProductImage
        image={tile.cover}
        /* The slug, so an empty category's gradient is its own and stays the
           same on every render and every page. */
        placeholderLabel={tile.slug}
        sizes={sizes}
        crop="portrait"
        maxWidth={828}
        className="ease-out-soft duration-slow absolute inset-0 h-full transition-transform motion-safe:group-hover:scale-[1.045]"
      />

      <span className="absolute inset-x-0 bottom-0 z-2 bg-gradient-to-t from-[rgba(38,25,32,.78)] to-transparent p-4 pt-10">
        <span className="font-display block text-[1.15rem] leading-tight font-medium text-white">
          {tile.name}
        </span>
        {/*
         * "Coming soon" rather than "0 pieces" on an empty category. The
         * count is useful information once there is stock; zero is an
         * apology, and it would sit under four of the five tiles for months.
         */}
        <span className="text-copy-xs mt-0.5 block text-white/90">
          {tile.count > 0
            ? `${tile.count} ${tile.count === 1 ? "piece" : "pieces"}`
            : "Coming soon"}
        </span>
      </span>
    </Link>
  );
}
