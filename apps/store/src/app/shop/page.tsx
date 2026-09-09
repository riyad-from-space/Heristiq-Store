import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductCardTile } from "@/components/product/product-card";
import { EmptyResults, FilterBar } from "@/components/shop/filter-bar";
import { Container, SectionHeader } from "@/components/ui/layout";
import { collections, finishes, motifs, site } from "@/config/site";
import { erp } from "@/lib/erp";
import { SORTS, type ProductQuery, type SortKey } from "@/lib/erp/types";

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

/** Only accept values we know, so a hand-typed ?finish=foo cannot 500. */
function parseQuery(raw: Record<string, string | string[] | undefined>): ProductQuery {
  const one = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const finish = one("finish");
  const motif = one("motif");
  const collection = one("collection");
  const sort = one("sort");
  const q = one("q");

  return {
    finish: finish && finish in finishes ? (finish as ProductQuery["finish"]) : undefined,
    motif: motif && motif in motifs ? (motif as ProductQuery["motif"]) : undefined,
    collection:
      collection && collection in collections
        ? (collection as ProductQuery["collection"])
        : undefined,
    /* Trimmed and length-capped. Everything else here is validated against a
       known key set; a free-text field cannot be, so the only guards
       available are "not blank" and "not absurd". */
    q: q?.trim().slice(0, 60) || undefined,
    sort: sort && sort in SORTS ? (sort as SortKey) : "featured",
  };
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/shop">): Promise<Metadata> {
  const query = parseQuery(await searchParams);

  /* A filtered view gets its own title, but is canonicalised back to /shop so
     the same seven products are not indexed as six near-duplicate pages. */
  const facet = query.q
    ? `Search: ${query.q}`
    : query.collection
      ? `${collections[query.collection].label} waist chains`
      : query.finish
        ? `${finishes[query.finish].label} waist chains`
        : query.motif
          ? `${motifs[query.motif].label} waist chains`
          : "Waist chains";

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
  const products = await erp().getProducts(query);

  const heading = query.q
    ? `“${query.q}”`
    : query.collection
      ? collections[query.collection].label
      : query.finish
        ? `${finishes[query.finish].label}`
        : query.motif
          ? motifs[query.motif].label
          : "Waist chains";

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
        lede={
          blurb ??
          "Gold and silver finishes on fine chain, sized to sit at the hip. Everything is in stock unless it says otherwise — sold-out pieces can be pre-ordered."
        }
      />

      <div className="mt-10 sm:mt-12">
        {/* useSearchParams needs a Suspense boundary above it. */}
        <Suspense fallback={<div className="h-24" />}>
          <FilterBar count={products.length} />
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
