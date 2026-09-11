import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { ProductImage } from "@/components/ui/product-image";

/*
 * The home hero.
 *
 * Asymmetric two columns — copy left, media right — per the approved mockup.
 * This replaces a full-bleed dark hero with a parallax celestial field; that
 * version's backdrop component is deleted rather than left unused.
 *
 * Two things it has to get right:
 *
 *  1. On a phone the MEDIA comes first (`order-first`), which is the mockup's
 *     behaviour and the right call for this audience: the shop is discovered
 *     from Instagram, so the first thing on screen should be the jewellery,
 *     not a headline about it.
 *
 *  2. It is where LCP is measured. See the note on the headline below — that
 *     is why the headline moves but does not fade, and why the media block
 *     reserves its aspect ratio rather than growing into place.
 *
 * The section stays a Server Component. Only the stagger wrapper is client,
 * and the copy passes through it as children, so the headline is in the HTML.
 */
export function Hero() {
  return (
    <section className="py-section-lg">
      <Container className="grid items-center gap-7 sm:gap-10 lg:grid-cols-[1.02fr_1.1fr] lg:gap-16">
        {/* onMount, not on scroll: this is already in view on load, and a
            whileInView trigger on the first screen is a race between the
            observer and the reader. This is the ONLY orchestrated entrance on
            the site — everything else is interaction feedback. */}
        <Stagger delay={0.05}>
          <StaggerItem>
            <span className="bg-rose-soft text-rose-deep rounded-pill inline-block px-3.5 py-1.5 text-[0.8rem] font-semibold">
              The autumn edit is here
            </span>
          </StaggerItem>

          {/*
           * `rise` — moves without fading, and the reason is Largest
           * Contentful Paint.
           *
           * This headline is the largest text on the largest screen of the
           * site, so it is very likely to BE the LCP element. An element at
           * opacity 0 has not been painted, so fading it in would defer LCP
           * by the animation's full duration — on the 3G phone that can least
           * afford it. A transform paints immediately and composites off the
           * main thread, so the movement is free.
           */}
          <StaggerItem rise className="mt-5">
            <h1 className="font-display text-display-xl font-medium">
              Body jewellery, made to{" "}
              {/* The one italic word, at weight 400 against the headline's
                  500 — straight from the mockup, and the whole reason the
                  display face carries an italic axis. */}
              <em className="font-normal italic">move</em> with you.
            </h1>
          </StaggerItem>

          <StaggerItem className="mt-5">
            <p className="text-copy-lg text-stone max-w-[46ch]">
              Contemporary body jewellery for every mood. Handmade in
              Bangladesh, styled for the everyday and the occasion.
            </p>
          </StaggerItem>

          <StaggerItem className="mt-7">
            <div className="flex flex-wrap items-center gap-3.5">
              <Button asChild size="lg">
                <Link href="/shop">Shop the collection</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/about">Our story</Link>
              </Button>
            </div>
          </StaggerItem>
        </Stagger>

        {/*
         * The media block, with the small overlapping swatch.
         *
         * `order-first lg:order-none` is the phone-first stack. The swatch
         * hangs off two edges, so nothing here may clip — the aspect-ratio
         * well lives on the ProductImage, not on this wrapper.
         */}
        <div className="relative order-first lg:order-none">
          <ProductImage
            image={{ id: "hero/home", alt: "Heristiq jewellery, autumn 2026" }}
            sizes="(min-width: 1024px) 52vw, 100vw"
            crop="wide"
            priority
            maxWidth={1440}
            className="rounded-media lg:aspect-4/5"
          />

          <span className="text-ink rounded-pill bg-blush/90 absolute top-3.5 left-3.5 px-2.5 py-1 text-[0.72rem] font-semibold">
            Autumn 2026
          </span>

          {/*
           * The overlapping swatch. Hidden below lg: on a phone the media is
           * already edge-to-edge and a block hanging off its corner would
           * either clip or force a horizontal scrollbar.
           *
           * It carried `image={undefined}` — the designed gradient placeholder
           * — which was right while the whole site was placeholders and wrong
           * the moment real photography landed beside it: one pink gradient
           * against a real photograph reads as a picture that failed to load,
           * not as decoration.
           *
           * A SILVER piece deliberately, because the hero image is gold. The
           * swatch's job is to hint that the range has more than one finish,
           * and it cannot do that showing the same metal as the photograph it
           * overlaps. Still aria-hidden: it is decoration, and a screen
           * reader announcing a second product here would imply the hero is
           * about two pieces.
           */}
          <div
            aria-hidden
            className="border-blush rounded-card absolute -bottom-5 -left-5 hidden w-[130px] overflow-hidden border-6 shadow-[0_20px_40px_-24px_rgba(42,33,38,.55)] lg:block"
          >
            <ProductImage
              image={{ id: "wc-005/front", alt: "" }}
              sizes="130px"
              crop="square"
              maxWidth={320}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
