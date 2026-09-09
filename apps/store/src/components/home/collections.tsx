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
  const tiles = (Object.keys(collections) as CollectionKey[])
    .map((key) => {
      const inMood = products.filter((p) => p.collections.includes(key));
      return { key, ...collections[key], products: inMood };
    })
    .filter((tile) => tile.products.length > 0);

  if (tiles.length === 0) return null;

  return (
    <Section tone="sand" as="div">
      <Container>
        <SectionHeader
          title="Shop by mood"
          lede="Four ways to wear the chain, from a quiet everyday to the night out."
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
                image={tile.products[0]?.images[0]}
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
