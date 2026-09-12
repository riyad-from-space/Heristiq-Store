import { Hero } from "@/components/home/hero";
import { TrustStrip } from "@/components/home/trust-strip";
import { ProductGrid } from "@/components/home/featured";
import { CategoryTiles } from "@/components/home/category-tiles";
import { Collections } from "@/components/home/collections";
import { StoryBand } from "@/components/home/story-band";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { Reviews } from "@/components/home/reviews";
import { ScrollReveal } from "@/components/motion/reveal";
import { InstagramFeed } from "@/components/home/instagram-feed";
import { erp } from "@/lib/erp";
import type { ProductCard } from "@/lib/erp/types";
import { site } from "@/config/site";
import { jsonLd } from "@/lib/json-ld";

/*
 * Home.
 *
 * Cached for 5 minutes rather than rendered per request. Price and stock come
 * from the ERP, and a phone on 3G should not wait on a database round trip for
 * a page whose content changes when the owner edits a price — which is a few
 * times a week, not a few times a second. The PDP revalidates faster because
 * that is where a stale stock number actually costs money.
 */
export const revalidate = 300;

/*
 * Take `count` products, spreading across categories before going deep in any
 * one of them.
 *
 * Within a category the flagged-featured come first, so the owner's judgement
 * still decides WHICH waist chain appears — it just no longer decides that
 * all three are waist chains. Falls back to plain order when nothing is
 * flagged, because a merchandising oversight should not blank half the home
 * page.
 */
function oneEachCategory(
  products: ProductCard[],
  count: number,
): ProductCard[] {
  const byCategory = new Map<string, ProductCard[]>();
  for (const product of products) {
    const key = product.category?.slug ?? "";
    const list = byCategory.get(key);
    if (list) list.push(product);
    else byCategory.set(key, [product]);
  }

  for (const list of byCategory.values()) {
    list.sort((a, b) => Number(b.featured) - Number(a.featured));
  }

  /* Round robin: one from each category, then a second from each, until full.
     `products` is already in the order getProducts returned, so categories are
     visited in the order the shop itself lists them. */
  const picked: ProductCard[] = [];
  const lists = [...byCategory.values()];
  for (let depth = 0; picked.length < count; depth++) {
    let anyAtThisDepth = false;
    for (const list of lists) {
      const product = list[depth];
      if (!product) continue;
      picked.push(product);
      anyAtThisDepth = true;
      if (picked.length === count) break;
    }
    if (!anyAtThisDepth) break;
  }
  return picked;
}

export default async function HomePage() {
  const client = erp();
  const [products, categories] = await Promise.all([
    client.getProducts({ sort: "featured" }),
    client.getCategories(),
  ]);
  /*
   * The two grids split the catalogue rather than sharing it, so no piece
   * appears twice on one page.
   *
   * "New this week" takes three, ONE PER CATEGORY where it can. It used to
   * take the first three flagged `featured`, and every flagged piece is a
   * waist chain — so the row that exists to show what the shop sells showed
   * one category, on a site that sells five. Whoever ticks that box in the
   * ERP is thinking "this piece is good", not "this piece represents its
   * category", and the home page should not depend on them meaning the
   * second thing.
   *
   * Three because the mockup's feature card spans two columns, so 2 + 1 + 1
   * fills a four-column row. "The edit" takes everything else.
   */
  const fresh = oneEachCategory(products, 3);
  const freshIds = new Set(fresh.map((p) => p.id));
  const edit = products.filter((p) => !freshIds.has(p.id));

  return (
    <>
      {/*
       * The hero is NOT wrapped. It animates on load already, and it is above
       * the fold — a scroll reveal on something the reader has not scrolled to
       * is a delay pretending to be an effect.
       *
       * Everything below arrives as it comes into view. Deliberately not
       * every band: TrustStrip, InstagramFeed and NewsletterSection are the
       * page's footer furniture, and animating those is what makes a site feel
       * like it is performing rather than working.
       */}
      <Hero />
      {/* Structure before mood: a first-time visitor needs to know WHAT is
          sold before being asked which feeling they are shopping for. */}
      <ScrollReveal>
        <CategoryTiles categories={categories} products={products} />
      </ScrollReveal>
      <ScrollReveal>
        <Collections products={products} />
      </ScrollReveal>
      <ScrollReveal>
        <ProductGrid
          products={fresh}
          eyebrow="The collection"
          title="New this week"
          /* Not "fresh off the bench" — a bench is where a maker works, and
             this shop does not make these. */
          lede="Just landed — small batches, restocked when they sell out."
          linkLabel="See everything new"
          feature
          priority
        />
      </ScrollReveal>
      <ScrollReveal>
        <StoryBand />
      </ScrollReveal>
      <ScrollReveal>
        <ProductGrid
          products={edit}
          title="The edit"
          lede="The pieces we keep restocking — and the ones you keep asking for."
          linkLabel="Shop everything"
        />
      </ScrollReveal>
      {/* Reviews sit UNDER the edit, where someone who has just scrolled two
          grids of product is deciding whether to trust the shop. */}
      <ScrollReveal>
        <Reviews products={products} />
      </ScrollReveal>
      <TrustStrip />
      <InstagramFeed />
      <NewsletterSection />

      {/* Organisation-level structured data. Product JSON-LD lives on the PDP,
          which is the page Google actually shows a price against. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: site.name,
            url: site.url,
            description: site.description,
            address: { "@type": "PostalAddress", addressCountry: "BD" },
            sameAs: Object.values(site.social),
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer service",
              telephone: `+880${site.contact.phone.slice(1)}`,
              areaServed: "BD",
              availableLanguage: ["en", "bn"],
            },
          }),
        }}
      />
    </>
  );
}
