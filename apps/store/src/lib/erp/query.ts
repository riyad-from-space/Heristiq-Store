import { collections, finishes, motifs } from "@/config/site";
import { SORTS, type ProductQuery, type SortKey } from "@/lib/erp/types";

/*
 * Search params → a ProductQuery, validated.
 *
 * Lifted out of /shop/page.tsx because the category pages need exactly the
 * same parsing. The finish and motif chips on the filter bar set the same
 * params whichever page they are rendered on, so a category page that could
 * not read them would show chips that appear to do nothing — the URL would
 * change and the grid would not.
 *
 * Every value is checked against a known key set, so a hand-typed
 * ?finish=foo yields undefined rather than an empty grid or a 500. The one
 * exception is `q`, which is free text and can only be guarded on shape.
 */
export function parseQuery(
  raw: Record<string, string | string[] | undefined>,
): ProductQuery {
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
    finish:
      finish && finish in finishes
        ? (finish as ProductQuery["finish"])
        : undefined,
    motif:
      motif && motif in motifs ? (motif as ProductQuery["motif"]) : undefined,
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
