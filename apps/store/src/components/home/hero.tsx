import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/layout";
import { cloudinarySrcSet } from "@/lib/cloudinary";

/*
 * The home hero.
 *
 * Two things it has to survive:
 *
 *  1. No photography yet. So the ground is the deep-sea tone with a fine
 *     celestial field drawn in CSS, and the hero photograph — when it exists at
 *     heristiq/hero/home — layers over it at reduced opacity. The hero is
 *     designed to look finished either way, not to look broken until the shoot.
 *
 *  2. The header sits ON it. -mt-16/-mt-20 cancels the main element's top
 *     padding so the section runs to the top of the viewport under a
 *     transparent header.
 *
 * Height is min-h-[88svh], not 100vh: svh accounts for mobile browser chrome,
 * and stopping short of the fold shows a sliver of the next section, which is
 * what tells a phone user there is more.
 */
export function Hero() {
  const image = cloudinarySrcSet("hero/home", { crop: "natural" });

  return (
    <section className="relative -mt-16 flex min-h-[88svh] items-end overflow-hidden bg-sea sm:-mt-20 sm:min-h-[92svh]">
      {image && (
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
      )}

      {/* The celestial field: two radial washes and a fine dot grid. Cheap,
          resolution-independent, and it reads as night sky rather than as a
          gradient. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 70% 15%, rgba(164,133,76,0.28), transparent 70%)," +
            "radial-gradient(ellipse 60% 50% at 10% 90%, rgba(47,71,83,0.9), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(250,247,242,0.55) 0.5px, transparent 0.5px)",
          backgroundSize: "34px 34px",
        }}
      />
      {/* Scrim under the copy only, so the top of the image stays clean. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-sea via-sea/70 to-transparent"
      />

      <Container className="relative pb-14 sm:pb-20">
        <Eyebrow onDark>Waist chains · Gold &amp; silver</Eyebrow>

        <h1 className="font-display mt-6 max-w-3xl text-display-xl font-normal text-bone">
          Worn low,
          <br />
          <span className="text-gold-wash italic">noticed twice.</span>
        </h1>

        <p className="mt-6 max-w-md text-base leading-relaxed text-bone/75">
          Moons, starfish and shells on fine chain — body jewellery you can
          actually wear every day. Cash on delivery, anywhere in Bangladesh.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" variant="gold">
            <Link href="/shop">Shop the collection</Link>
          </Button>
          <Button asChild size="lg" variant="onDark">
            <Link href="/about">Our story</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
