import Link from "next/link";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/layout";
import { cloudinarySrcSet } from "@/lib/cloudinary";

/*
 * The home hero.
 *
 * Three things it has to survive:
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
 *  3. It is almost certainly where LCP is measured. See the note on the
 *     headline below — that is why the headline moves but does not fade.
 *
 * Height is min-h-[88svh], not 100vh: svh accounts for mobile browser chrome,
 * and stopping short of the fold shows a sliver of the next section, which is
 * what tells a phone user there is more.
 *
 * This stays a server component. Only the backdrop (which needs a scroll
 * position) and the stagger wrapper (which needs an effect) are client, and
 * the copy is passed through as children — so the headline is in the HTML.
 */
export function Hero() {
  const image = cloudinarySrcSet("hero/home", { crop: "natural" });

  return (
    <section className="bg-sea relative -mt-16 flex min-h-[88svh] items-end overflow-hidden sm:-mt-20 sm:min-h-[92svh]">
      <HeroBackdrop
        image={image ? { src: image.src, srcSet: image.srcSet } : null}
      />

      <Container className="relative pb-14 sm:pb-20">
        {/* onMount, not on scroll: this is already in view on load, and a
            whileInView reveal on the first screen is a race between the
            observer and the reader. */}
        <Stagger onMount delay={0.08}>
          <StaggerItem>
            <Eyebrow onDark>Waist chains · Gold &amp; silver</Eyebrow>
          </StaggerItem>

          {/*
           * `rise` — moves without fading, and the reason is Largest
           * Contentful Paint.
           *
           * This headline is the largest text on the largest screen of the
           * site, so it is very likely to BE the LCP element. An element at
           * opacity 0 has not been painted, so fading it in would defer LCP
           * by the full animation duration — 700ms added to the one metric
           * that decides whether the page felt fast, on the 3G phone that
           * can least afford it. A transform paints immediately and
           * composites off the main thread, so the movement is free.
           */}
          <StaggerItem rise className="mt-6">
            <h1 className="font-display text-display-xl text-bone max-w-3xl font-normal">
              Worn low,
              <br />
              <span className="text-gold-wash italic">noticed twice.</span>
            </h1>
          </StaggerItem>

          <StaggerItem className="mt-6">
            <p className="text-copy-lg text-bone/75 max-w-md">
              Moons, starfish and shells on fine chain — body jewellery you can
              actually wear every day. Cash on delivery, anywhere in Bangladesh.
            </p>
          </StaggerItem>

          <StaggerItem className="mt-9">
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="gold">
                <Link href="/shop">Shop the collection</Link>
              </Button>
              <Button asChild size="lg" variant="onDark">
                <Link href="/about">Our story</Link>
              </Button>
            </div>
          </StaggerItem>
        </Stagger>
      </Container>
    </section>
  );
}
