import { Suspense } from "react";
import { ProductCardTile } from "@/components/product/product-card";
import { EmptyCategory } from "@/components/shop/empty-category";
import { FilterBar } from "@/components/shop/filter-bar";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, SectionHeader } from "@/components/ui/layout";
import type { Category, ProductCard } from "@/lib/erp/types";

/*
 * One category's listing.
 *
 * Structurally identical to /shop on purpose — same Container padding, same
 * SectionHeader, same FilterBar, same two-then-three column grid. A category
 * page that laid its products out differently from the shop page would read
 * as a different website, and there is no reason for the difference to exist:
 * both are "a heading and a grid of pieces".
 *
 * So this is not a new design. It is /shop with a narrower question.
 */
export function CategoryView({
  category,
  products,
  categories,
}: {
  category: Category;
  products: ProductCard[];
  /** For the chip row. Passed in rather than fetched so this stays a pure view. */
  categories: Category[];
}) {
  return (
    <Container className="py-6 sm:py-10">
      <Breadcrumbs
        className="mb-6"
        trail={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: category.name },
        ]}
      />

      <SectionHeader
        as="h1"
        size="l"
        eyebrow="The collection"
        title={category.name}
        /*
         * The blurb is the owner's, typed in the ERP. The fallback is
         * deliberately generic rather than clever: a category the owner adds
         * next year should read sensibly before anyone has written copy for
         * it, and guessing at "Rings are..." for an unknown category would
         * produce nonsense.
         */
        lede={
          category.blurb ??
          "Gold and silver finishes on fine chain. Everything is in stock unless it says otherwise — sold-out pieces can be pre-ordered."
        }
      />

      <div className="mt-10 sm:mt-12">
        {/* useSearchParams needs a Suspense boundary above it. */}
        <Suspense fallback={<div className="h-24" />}>
          <FilterBar count={products.length} categories={categories} />
        </Suspense>
      </div>

      {products.length === 0 ? (
        <div className="mt-12">
          <EmptyCategory name={category.name} />
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3">
          {products.map((product, index) => (
            <div key={product.id}>
              <ProductCardTile
                product={product}
                sizes={"(min-width: 1024px) 30vw, 45vw"}
                priority={index < 2}
              />
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
