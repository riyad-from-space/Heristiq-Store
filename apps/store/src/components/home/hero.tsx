import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { ProductImage } from "@/components/ui/product-image";
import { editorial } from "@/config/site";

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
              New in — eight gold-finish bracelets
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
              {/* "Body jewellery" was true when waist chains were the only
                  thing sold. The shop now lists bracelets, rings, earrings and
                  pendants, none of which is body jewellery — the same
                  narrowing that had /shop headed "Waist chains". */}
              Jewellery made to{" "}
              {/* The one italic word, at weight 400 against the headline's
                  500 — straight from the mockup, and the whole reason the
                  display face carries an italic axis. */}
              <em className="font-normal italic">move</em> with you.
            </h1>
          </StaggerItem>

          <StaggerItem className="mt-5">
            <p className="text-copy-lg text-stone max-w-[46ch]">
              Waist chains, bracelets, rings and earrings in gold and silver
              finishes — priced to wear on an ordinary Tuesday, not to keep in a
              box for a wedding.
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
         * The media block: one editorial photograph, with a second overlapping
         * it on desktop.
         *
         * `order-first lg:order-none` is the phone-first stack — the shop is
         * found on Instagram, so the first thing on screen should be the
         * jewellery, not a headline about it.
         *
         * WHAT CHANGED AND WHY. This was a product shot on denim plus a 130px
         * square swatch. Both are honest, and neither makes anyone want
         * anything: flat-lays state what a piece IS. The primary photograph is
         * now the only one in the set with a person in it, because a wrist
         * wearing five bangles answers the question a flat-lay leaves open —
         * what does this look like on me.
         *
         * The second photograph is a real image at a real size rather than a
         * thumbnail, so the pair reads as an editorial spread. It is desktop
         * only: on a phone the primary is already edge-to-edge and anything
         * hanging off its corner either clips or forces a sideways scroll.
         *
         * Nothing here may clip, so the aspect-ratio wells live on the
         * ProductImages and never on this wrapper.
         */}
        <div className="order-first grid gap-3 lg:order-none lg:grid-cols-[1.55fr_1fr] lg:items-end">
          <div className="relative">
            <ProductImage
              image={editorial.worn}
              sizes="(min-width: 1024px) 34vw, 100vw"
              /*
               * PORTRAIT, not wide. The subject is a vertical arm in a
               * vertical frame; a 16:9 crop threw most of the stack away and
               * kept a band of wall.
               */
              crop="portrait"
              priority
              maxWidth={1080}
              className="rounded-media"
            />

            <span className="text-ink rounded-pill bg-blush/90 absolute top-3.5 left-3.5 z-2 px-2.5 py-1 text-[0.72rem] font-semibold">
              Autumn 2026
            </span>
          </div>

          {/*
           * The second photograph, BESIDE the first rather than on top of it.
           *
           * It started as an overlapping card, which is the usual editorial
           * move and was wrong for this pair: the subject of the main
           * photograph — five bangles on a wrist — sits low and left in the
           * frame, exactly where an overlapping card lands. It covered the
           * one thing the picture is of.
           *
           * Side by side with `items-end`, the shorter frame aligns to the
           * bottom and the height difference does the work the overlap was
           * supposed to do. Nothing is hidden, and nothing can clip or force a
           * sideways scroll.
           *
           * Deliberately a different KIND of picture: the first is a piece
           * being worn, this is the pieces themselves, close and textured. Two
           * shots of the same kind would read as a gallery that lost its
           * arrows.
           *
           * Desktop only. At 390px the main photograph is already
           * edge-to-edge, and splitting that width in two would make both
           * unreadable.
           */}
          <div aria-hidden className="hidden lg:block">
            <ProductImage
              image={editorial.shore}
              sizes="22vw"
              crop="portrait"
              maxWidth={828}
              className="rounded-media aspect-[4/4.6]"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
