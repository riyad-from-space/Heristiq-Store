import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import { collections, type CollectionKey } from "@/config/site";
import type { ProductCard } from "@/lib/erp/types";

/*
 * "Shop by mood" — four tiles onto the collection taxonomy.
 *
 * Each tile links to the /shop filter that already exists, so this is a way
 * INTO the catalogue rather than a second catalogue. The image is the first
 * photograph from the first piece in that mood, which means the tile
 * illustrates itself from real merchandising instead of needing four more
 * assets nobody has shot yet.
 *
 * Only moods with something in them are rendered. A tile that leads to an
 * empty shop page is worse than a three-tile row: the customer taps a
 * promise and lands on "nothing matched". With the current catalogue all four
 * are populated, so this is a guard rather than a visible behaviour — but it
 * is the guard that lets the owner add a mood before tagging anything to it.
 */
export function Collections({ products }: { products: ProductCard[] }) {
  /*
   * Each tile shows a piece from a DIFFERENT category, where one exists.
   *
   * The cover used to be `products[0]` — the first piece in that mood — and
   * every mood's first piece was a waist chain, because that is what sorts
   * first. So the row that exists to say "there are four ways to wear this"
   * showed the same kind of thing four times, on a shop that sells five
   * categories. A customer could reasonably conclude we only sell waist
   * chains, which is the exact impression the category work was meant to end.
   *
   * Greedy rather than clever: walk the moods in order and take the first
   * piece whose category has not been used yet, falling back to the first
   * piece when every category is already spoken for. With two categories
   * stocked it alternates; as earrings and rings arrive it spreads further on
   * its own, with nothing to maintain.
   */
  const used = new Set<string>();
  const tiles = (Object.keys(collections) as CollectionKey[])
    .map((key) => {
      const inMood = products.filter((p) => p.collections.includes(key));

      /*
       * Take a category not used yet — and when they have ALL been used,
       * start the round again rather than giving up.
       *
       * Without the reset this exhausted after two tiles and the remaining
       * moods fell back to whatever sorted first, which is a waist chain: the
       * row came out three waist chains and one bracelet. Cycling alternates
       * instead, so with two categories stocked it reads 2 and 2, and it
       * spreads further on its own as earrings and rings arrive.
       */
      let cover = inMood.find((p) => p.category && !used.has(p.category.slug));
      if (!cover) {
        used.clear();
        cover = inMood.find((p) => p.category && !used.has(p.category.slug));
      }
      cover ??= inMood[0];
      if (cover?.category) used.add(cover.category.slug);

      return { key, ...collections[key], products: inMood, cover };
    })
    .filter((tile) => tile.products.length > 0);

  if (tiles.length === 0) return null;

  return (
    <Section tone="sand" as="div">
      <Container>
        <SectionHeader
          title="Shop by mood"
          lede="Four ways to wear Heristiq, from a quiet everyday to the night out."
          action={
            <Link
              href="/shop"
              className="text-rose-deep decoration-rose-soft hover:decoration-rose-deep duration-quick inline-flex items-center gap-1.5 border-b-[1.5px] border-transparent pb-0.5 font-semibold transition-colors"
            >
              View all styles <ArrowRight size={15} />
            </Link>
          }
        />

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              href={`/shop?collection=${tile.key}`}
              className="group rounded-card focus-visible:outline-rose relative block aspect-[3/3.7] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <ProductImage
                image={tile.cover?.images[0]}
                sizes="(min-width: 1024px) 23vw, 46vw"
                crop="portrait"
                maxWidth={828}
                className="ease-out-soft duration-slow absolute inset-0 h-full transition-transform motion-safe:group-hover:scale-[1.045]"
              />

              {/*
               * The label sits on a gradient rather than a solid bar, so the
               * photograph stays visible behind it. The gradient is what
               * makes white text legible over an image whose brightness we
               * cannot know in advance — a plain white label over a pale
               * shot would vanish.
               */}
              <span className="absolute inset-x-0 bottom-0 z-2 bg-gradient-to-t from-[rgba(38,25,32,.78)] to-transparent p-4 pt-10">
                <span className="font-display block text-[1.25rem] font-medium text-white">
                  {tile.label}
                </span>
                <span className="text-copy-xs mt-0.5 block text-white/90">
                  {tile.blurb}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}
