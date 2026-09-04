import { InstagramIcon } from "@/components/ui/brand-icons";
import { Container, Eyebrow } from "@/components/ui/layout";
import { ProductImage } from "@/components/ui/product-image";
import { site } from "@/config/site";

/*
 * The Instagram row.
 *
 * Not a live feed. The Basic Display API is retired, and the Graph API needs a
 * business account, an App Review and a token that has to be refreshed on a
 * schedule — real ongoing work for a strip of six pictures.
 *
 * So this is six Cloudinary tiles the owner uploads alongside the product
 * shots, each linking to the profile. It looks the same, never breaks when a
 * token expires, and costs nothing to run. If a live feed is wanted later, the
 * seam is this component's `tiles` prop: fetch them in a cached server
 * component and pass them in.
 */
const tiles = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `social/${n}`,
  alt: `Heristiq on Instagram, photo ${n}`,
}));

export function InstagramFeed() {
  return (
    <div className="py-16 sm:py-24">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Instagram</Eyebrow>
            <p className="font-display mt-4 text-display-s">@heristiq</p>
          </div>
          <a
            href={site.social.instagram}
            className="text-eyebrow inline-flex items-center gap-2 uppercase decoration-1 underline-offset-8 hover:underline"
          >
            <InstagramIcon size={15} /> Follow
          </a>
        </div>
      </Container>

      {/* Full-bleed on purpose: an edge-to-edge band of squares is the visual
          break between the page and the footer. */}
      <div className="mt-8 grid grid-cols-3 gap-1 sm:mt-10 sm:grid-cols-6">
        {tiles.map((tile) => (
          <a
            key={tile.id}
            href={site.social.instagram}
            aria-label="View on Instagram"
            className="group relative block"
          >
            <ProductImage
              image={tile}
              crop="square"
              sizes="(min-width: 640px) 17vw, 33vw"
              maxWidth={640}
            />
            <span className="absolute inset-0 grid place-items-center bg-sea/0 text-bone opacity-0 transition group-hover:bg-sea/40 group-hover:opacity-100">
              <InstagramIcon size={18} />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
