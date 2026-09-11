import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCardTile } from "@/components/product/product-card";
import { EmptyResults, FilterBar } from "@/components/shop/filter-bar";
import { Container, SectionHeader } from "@/components/ui/layout";
import { collections, finishes, motifs, site } from "@/config/site";
import { erp } from "@/lib/erp";
import { parseQuery } from "@/lib/erp/query";

/*
 * The shop.
 *
 * Rendered per request rather than statically, because it is filtered by
 * search params and because stock changes underneath it. Cached for a minute at
 * the fetch layer is not available here (Supabase is not fetch-based), so the
 * cost is one indexed read of a seven-row view — cheap enough that correctness
 * wins.
 */
export const dynamic = "force-dynamic";

/* parseQuery moved to lib/erp/query.ts — the category pages parse the same
   params, and two copies would drift. */

export async function generateMetadata({
  searchParams,
}: PageProps<"/shop">): Promise<Metadata> {
  const query = parseQuery(await searchParams);

  /* A filtered view gets its own title, but is canonicalised back to /shop so
     the same seven products are not indexed as six near-duplicate pages. */
  /* "jewellery", not "waist chains". These become the <title> — what Google
     lists and what a shared link previews as — and /shop?finish=gold now
     covers gold rings and earrings too, so "Gold waist chains" would be the
     wrong promise in a search result. */
  const facet = query.q
    ? `Search: ${query.q}`
    : query.collection
      ? `${collections[query.collection].label} jewellery`
      : query.finish
        ? `${finishes[query.finish].label} jewellery`
        : query.motif
          ? `${motifs[query.motif].label} jewellery`
          : "Everything";

  return {
    title: facet,
    description: `${facet} in ${site.name}'s collection. Cash on delivery across Bangladesh.`,
    alternates: { canonical: "/shop" },
        /* A faceted or searched view is canonicalised back to /shop and left out
       of the index, so the same seven products are not indexed as a dozen
       near-duplicate pages. A search results page in particular has no
       business in a search engine. */
    robots:
      query.finish || query.motif || query.collection || query.q
        ? { index: false, follow: true }
        : undefined,
  };
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const query = parseQuery(await searchParams);
  const client = erp();
  const [products, categories] = await Promise.all([
    client.getProducts(query),
    client.getCategories(),
  ]);

  /* "Everything", not "Waist chains". This page has shown every product since
     it was built; the old default was accurate only while waist chains were
     the only category, and it would now be the wrong heading over a grid
     containing bracelets. */
  const heading = query.q
    ? `“${query.q}”`
    : query.collection
      ? collections[query.collection].label
      : query.finish
        ? `${finishes[query.finish].label}`
        : query.motif
          ? motifs[query.motif].label
          : "Everything";

  const blurb = query.q
    ? `${products.length} ${products.length === 1 ? "piece" : "pieces"} match your search.`
    : query.collection
      ? collections[query.collection].lede
      : query.motif
        ? motifs[query.motif].blurb
        : null;

  return (
    <Container className="py-10 sm:py-16">
      <SectionHeader
        as="h1"
        size="l"
        eyebrow="The collection"
        title={heading}
        /* "sized to sit at the hip" was true of waist chains and is not true
           of earrings, so the shop-wide copy no longer describes one kind of
           piece. The per-category blurbs say the specific thing. */
        lede={
          blurb ??
          "Gold and silver finishes, made for everyday wear. Everything is in stock unless it says otherwise — sold-out pieces can be pre-ordered."
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
          <Suspense fallback={null}>
            <EmptyResults />
          </Suspense>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3">
          {products.map((product, index) => (
            <div key={product.id}>
              <ProductCardTile
                product={product}
                /* The first row is above the fold on a phone; everything else
                   stays lazy so the grid does not fetch nine images at once. */
                priority={index < 2}
              />
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
