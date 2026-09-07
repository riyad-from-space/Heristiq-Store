import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCardTile } from "@/components/product/product-card";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import type { ProductCard } from "@/lib/erp/types";

/*
 * Featured pieces.
 *
 * On a phone this is a horizontal snap rail rather than a stacked grid: four
 * stacked cards is four screens of scrolling before the customer reaches the
 * story below, and a rail keeps the whole selection in one thumb sweep. From
 * sm: up it becomes a real grid.
 */
/* Spelled out, because "Three pieces" reads as copy and "3 pieces" reads as a
   database field. Only ever called for the handful the home page shows. */
const COUNT_WORDS: Record<number, string> = {
  2: "Two",
  3: "Three",
  4: "Four",
};

export function Featured({ products }: { products: ProductCard[] }) {
  if (products.length === 0) return null;

  return (
    <Section>
      <Container>
        <div className="flex items-end justify-between gap-6">
          {/*
           * The heading counts the pieces it is actually showing. It read
           * "Four pieces people keep coming back for" as a hard-coded string,
           * which is wrong the moment the owner flags three as featured or
           * the catalogue drops below four — and the fallback path above can
           * hand this fewer than four.
           */}
          <SectionHeader
            eyebrow="The collection"
            title={
              products.length === 1
                ? "The piece people keep coming back for"
                : `${COUNT_WORDS[products.length] ?? products.length} pieces people keep coming back for`
            }
          />
          <Link
            href="/shop"
            className="text-eyebrow hidden shrink-0 items-center gap-2 uppercase decoration-1 underline-offset-8 hover:underline sm:inline-flex"
          >
            See all <ArrowRight size={14} />
          </Link>
        </div>
      </Container>

      {/* The rail bleeds into the gutter on purpose — a card half-cut at the
          right edge is what makes it obvious the row scrolls. */}
      <div className="mt-10 sm:mt-14">
        {/* scroll-pl-5 as well as px-5: scroll-snap aligns a snap-start child
            to the SNAPPORT edge, which ignores padding, so padding alone makes
            the browser scroll the gutter away and the first card sits flush to
            the screen edge. scroll-padding moves the snapport instead. */}
        <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scroll-pl-5 sm:hidden">
          {products.map((product, index) => (
            <div key={product.id} className="w-[74vw] shrink-0 snap-start">
              <ProductCardTile product={product} priority={index === 0} />
            </div>
          ))}
        </div>

        <Container className="hidden sm:block">
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCardTile key={product.id} product={product} />
            ))}
          </div>
        </Container>
      </div>

      <Container className="mt-10 sm:hidden">
        <Link
          href="/shop"
          className="text-eyebrow inline-flex items-center gap-2 uppercase decoration-1 underline-offset-8 hover:underline"
        >
          See all pieces <ArrowRight size={14} />
        </Link>
      </Container>
    </Section>
  );
}
