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
  { finish, motif, sort = "featured", includeOutOfStock = true }: ProductQuery,
): ProductCard[] {
  let rows = products;

  if (finish) rows = rows.filter((p) => p.finish === finish);
  if (motif) rows = rows.filter((p) => p.motif === motif);
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

function toCard(p: Product): ProductCard {
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    finish: p.finish,
    motif: p.motif,
    images: p.images,
    availability: p.availability,
    featured: p.featured,
  };
}
