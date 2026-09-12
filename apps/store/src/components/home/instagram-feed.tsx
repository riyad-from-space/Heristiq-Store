import { InstagramIcon } from "@/components/ui/brand-icons";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import { ProductImage } from "@/components/ui/product-image";
import { site, socialTiles } from "@/config/site";

/*
 * The Instagram row — "As worn by you".
 *
 * Not a live feed. The Basic Display API is retired, and the Graph API needs a
 * business account, an App Review and a token that has to be refreshed on a
 * schedule — real ongoing work for a strip of six pictures, and a strip that
 * breaks silently the day the token lapses.
 *
 * So this is tiles the owner uploads alongside the product shots, each
 * linking to the profile. It looks the same, never breaks, and costs nothing
 * to run. If a live feed is wanted later the seam is `socialTiles`: fetch them
 * in a cached server component and pass them in.
 *
 * The ids come from config rather than being generated as social/1…social/6,
 * because generated ids cannot be verified. `npm run images:check` reads the
 * literal ids out of the source; a template string is invisible to it, and
 * these six were the one set of images nothing was checking. They 404'd on
 * the home page as soon as Cloudinary was configured.
 */
const tiles = socialTiles.map((id, index) => ({
  id,
  alt: `Heristiq on Instagram, photo ${index + 1}`,
}));

export function InstagramFeed() {
  /* Nothing to show until customers have tagged the shop. Returning null
     rather than rendering an empty grid keeps the two neighbouring sections'
     spacing correct — the same thing ProductGrid does with no products. */
  if (tiles.length === 0) return null;

  return (
    <Section as="div">
      <Container>
        <SectionHeader
          eyebrow="Instagram"
          title="As worn by you"
          lede={`Tag @${site.instagramHandle} to be featured.`}
          action={
            <a
              href={site.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-deep decoration-rose-soft hover:decoration-rose-deep duration-quick inline-flex items-center gap-2 border-b-[1.5px] border-transparent pb-0.5 font-semibold transition-colors"
            >
              <InstagramIcon size={15} /> Follow @{site.instagramHandle}
            </a>
          }
        />

        {/* Boxed and gapped, per the mockup. This used to be a full-bleed
            gap-1 mosaic, which read as one band rather than as six
            photographs. */}
        <div className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {tiles.map((tile) => (
            <a
              key={tile.id}
              href={site.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on Instagram"
              className="group rounded-tile focus-visible:outline-rose relative block aspect-square overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <ProductImage
                image={tile}
                crop="square"
                sizes="(min-width: 640px) 17vw, 33vw"
                maxWidth={640}
                className="absolute inset-0 h-full"
              />
              <span className="bg-plum/0 group-hover:bg-plum/45 duration-calm absolute inset-0 grid place-items-center text-white opacity-0 transition group-hover:opacity-100">
                <InstagramIcon size={18} />
              </span>
            </a>
          ))}
        </div>
      </Container>
    </Section>
  );
}
