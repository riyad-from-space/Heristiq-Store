import { collections, finishes, motifs } from "@/config/site";
import type { Product, ProductCard, ProductQuery } from "@/lib/erp/types";

/*
 * Filtering and ordering, shared by both clients so the shop grid behaves
 * identically against the mock and the real ERP.
 *
 * Price sorting has one rule worth stating: an UNPRICED product always sorts
 * last, in both directions. Treating null as zero would put every
 * "Price on request" piece at the top of "price: low to high", which is the
 * opposite of useful.
 */
export function sortProducts(
  products: Product[],
  {
    category,
    finish,
    motif,
    collection,
    q,
    sort = "featured",
    includeOutOfStock = true,
  }: ProductQuery,
): ProductCard[] {
  let rows = products;

  /* Compared on the slug, which the DATABASE derives — never re-slugified
     here. Two slugify implementations that disagree by one character would
     empty a category page with no error anywhere. */
  if (category) rows = rows.filter((p) => p.category?.slug === category);
  if (finish) rows = rows.filter((p) => p.finish === finish);
  if (motif) rows = rows.filter((p) => p.motif === motif);
  if (collection) {
    rows = rows.filter((p) => p.collections.includes(collection));
  }

  /*
   * Free-text search, from the header field.
   *
   * Done here rather than in either client because this function is the ONE
   * place both the mock and the Supabase catalogue pass through — so search
   * works with no credentials and against real data, with one implementation.
   *
   * Matched against the name, the tagline and the finish and motif LABELS
   * rather than their keys, because a customer types "gold" and "moon", not
   * "celestial". Every term must match something (AND, not OR): typing
   * "gold moon" should narrow, which is what a second word is for.
   */
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      rows = rows.filter((p) => {
        const haystack = [
          p.name,
          p.tagline ?? "",
          p.sku,
          p.finish ? finishes[p.finish].label : "",
          p.motif ? motifs[p.motif].label : "",
          ...p.collections.map((key) => collections[key].label),
        ]
          .join(" ")
          .toLowerCase();
        return terms.every((term) => haystack.includes(term));
      });
    }
  }
  if (!includeOutOfStock) {
    rows = rows.filter((p) => p.availability.state !== "pre_order");
  }
  rows = rows.filter((p) => p.availability.state !== "unavailable");

  const byPrice = (dir: 1 | -1) => (a: Product, b: Product) => {
    if (a.price === null && b.price === null) return a.position - b.position;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return (a.price - b.price) * dir;
  };

  const sorted = [...rows];
  switch (sort) {
    case "price_asc":
      sorted.sort(byPrice(1));
      break;
    case "price_desc":
      sorted.sort(byPrice(-1));
      break;
    case "newest":
      /* No created_at in the storefront's view, and position already encodes
         the owner's intended order, so newest is position ascending. */
      sorted.sort((a, b) => a.position - b.position);
      break;
    case "featured":
    default:
      sorted.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.position - b.position;
      });
  }

  return sorted.map(toCard);
}

/** Drop the PDP-only prose. Exported so the clients share one shape. */
export function toCard(p: Product): ProductCard {
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: p.category,
    finish: p.finish,
    motif: p.motif,
    collections: p.collections,
    images: p.images,
    availability: p.availability,
    featured: p.featured,
  };
}
