import { Hero } from "@/components/home/hero";
import { TrustStrip } from "@/components/home/trust-strip";
import { ProductGrid } from "@/components/home/featured";
import { Collections } from "@/components/home/collections";
import { StoryBand } from "@/components/home/story-band";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { InstagramFeed } from "@/components/home/instagram-feed";
import { erp } from "@/lib/erp";
import { site } from "@/config/site";

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

export default async function HomePage() {
  const products = await erp().getProducts({ sort: "featured" });
  /*
   * The two grids split the catalogue rather than sharing it, so no piece
   * appears twice on one page.
   *
   * "New this week" takes the first three flagged featured, because the
   * mockup's feature card spans two columns and 2 + 1 + 1 fills a
   * four-column row with three products. "The edit" takes everything else.
   *
   * If nothing is flagged, the first three stand in — a merchandising
   * oversight should not blank half the home page.
   */
  const flagged = products.filter((p) => p.featured);
  const fresh = (flagged.length > 0 ? flagged : products).slice(0, 3);
  const freshIds = new Set(fresh.map((p) => p.id));
  const edit = products.filter((p) => !freshIds.has(p.id));

  return (
    <>
      <Hero />
      <Collections products={products} />
      <ProductGrid
        products={fresh}
        eyebrow="The collection"
        title="New this week"
        lede="Fresh off the bench — small batches, restocked when they sell out."
        linkLabel="See everything new"
        feature
        priority
      />
      <StoryBand />
      <ProductGrid
        products={edit}
        title="The waist chain edit"
        lede="The pieces we keep restocking — and the ones you keep asking for."
        linkLabel="Shop all chains"
      />
      <TrustStrip />
      <InstagramFeed />
      <NewsletterSection />

      {/* Organisation-level structured data. Product JSON-LD lives on the PDP,
          which is the page Google actually shows a price against. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
