import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCardTile } from "@/components/product/product-card";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import type { ProductCard } from "@/lib/erp/types";

/*
 * A product grid, used twice on the home page — "New this week" and "The
 * waist chain edit".
 *
 * One component rather than two, because the mockup's two grids differ only
 * in their words, whether the first card is a feature, and which pieces they
 * hold. Two files would have been two places to fix the next grid bug.
 *
 * The FEATURE card spans two columns on the widest layout, which is what makes
 * a four-column row hold three products: 2 + 1 + 1. That is the mockup's
 * arithmetic, and it is why "New this week" shows three pieces rather than
 * four — not a shortage of stock.
 *
 * On a phone this is a horizontal snap rail rather than a stacked column:
 * three or four stacked cards is three or four screens of scrolling before
 * the customer reaches anything else, and a rail keeps the selection in one
 * thumb sweep. The feature card loses its span there, because at two columns
 * there is nothing to span.
 */
export function ProductGrid({
  products,
  eyebrow,
  title,
  lede,
  linkLabel = "See everything new",
  feature = false,
  priority = false,
}: {
  products: ProductCard[];
  eyebrow?: string;
  title: string;
  lede?: string;
  linkLabel?: string;
  /** Give the first card two columns, per the mockup's first grid. */
  feature?: boolean;
  /** Set on the grid that is above the fold. */
  priority?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          lede={lede}
          action={
            <Link
              href="/shop"
              className="text-rose-deep decoration-rose-soft hover:decoration-rose-deep duration-quick inline-flex items-center gap-1.5 border-b-[1.5px] border-transparent pb-0.5 font-semibold transition-colors"
            >
              {linkLabel} <ArrowRight size={15} />
            </Link>
          }
        />
      </Container>

      {/* The rail bleeds into the gutter on purpose — a card half-cut at the
          right edge is what makes it obvious the row scrolls. */}
      <div className="mt-8">
        {/* scroll-pl-gutter as well as px-gutter: scroll-snap aligns a
            snap-start child to the SNAPPORT edge, which ignores padding, so
            padding alone makes the browser scroll the gutter away and the
            first card sits flush to the screen edge. scroll-padding moves the
            snapport instead. */}
        <div className="scrollbar-none px-gutter scroll-pl-gutter flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:hidden">
          {products.map((product, index) => (
            <div key={product.id} className="w-[74vw] shrink-0 snap-start">
              <ProductCardTile
                product={product}
                /* The rail's own card width, not the grid's. */
                sizes="74vw"
                priority={priority && index === 0}
              />
            </div>
          ))}
        </div>

        <Container className="hidden sm:block">
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 lg:grid-cols-4">
            {products.map((product, index) => (
              <div
                key={product.id}
                className={
                  feature && index === 0 ? "sm:col-span-2" : undefined
                }
              >
                <ProductCardTile
                  product={product}
                  /* 2 columns from sm, 4 from lg — and the feature card spans
                     two of those four, so it is twice as wide. */
                  sizes={
                    feature && index === 0
                      ? "(min-width: 1024px) 47vw, 46vw"
                      : "(min-width: 1024px) 23vw, 46vw"
                  }
                  feature={feature && index === 0}
                  priority={priority && index === 0}
                />
              </div>
            ))}
          </div>
        </Container>
      </div>
    </Section>
  );
}
