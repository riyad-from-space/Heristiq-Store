import { Hero } from "@/components/home/hero";
import { TrustStrip } from "@/components/home/trust-strip";
import { Featured } from "@/components/home/featured";
import { MotifStory } from "@/components/home/motif-story";
import { SocialProof } from "@/components/home/social-proof";
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
  const featured = products.filter((p) => p.featured).slice(0, 4);

  /* If nothing is flagged featured, show the first four rather than an empty
     section — a merchandising oversight should not blank the home page. */
  const showcase = featured.length > 0 ? featured : products.slice(0, 4);

  return (
    <>
      <Hero />
      <TrustStrip />
      <Featured products={showcase} />
      <MotifStory />
      <SocialProof />
      <InstagramFeed />

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
