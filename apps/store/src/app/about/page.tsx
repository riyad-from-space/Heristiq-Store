import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, ProseSection } from "@/components/site/prose";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ui/product-image";
import { business } from "@/config/business";
import { site } from "@/config/site";

/*
 * Prerendered, but not frozen.
 *
 * This page's own content is static — it changes when someone edits the file.
 * Its HEADER is not: the layout reads the category menu from the database, so
 * without a revalidate this page would keep serving the menu that existed the
 * day it was built, and a category the owner adds in the ERP would be missing
 * here while appearing everywhere else.
 *
 * An hour is the trade: still one cached render served from the edge to
 * effectively every visitor, and a new category shows up on its own rather
 * than waiting for the next deploy.
 */
export const revalidate = 3600;


/*
 * The brand story.
 *
 * Written to the motif the catalogue is actually built on — moons, starfish,
 * shells, oval links, gold and silver — because a story that does not match
 * the products reads as filler. No invented founder biography and no claims
 * about materials the ERP cannot back up.
 */
export const metadata: Metadata = {
  title: "Our story",
  description:
    /* NOT "makes ... in Bangladesh". This is the sentence Google prints under
       the result, so a manufacturing claim here is the one that travels
       furthest. Heristiq sells these pieces; it does not make them. */
    "Heristiq — waist chains, bracelets, rings, earrings and pendants in gold and silver finishes, chosen for everyday wear. Cash on delivery across Bangladesh.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: `Our story — ${site.name}`,
    description:
      "Modern jewellery for everyday wear rather than for a safe. Delivered across Bangladesh.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <ProsePage
      eyebrow="Our story"
      title="Jewellery you actually wear"
      lede={`${business.name} sells jewellery for everyday wear — not the kind that lives in a box and comes out twice a year.`}
    >
      <ProseSection title="Why we sell what we sell">
        <p>
          Body jewellery in Bangladesh has long meant one of two things: heavy
          gold kept for weddings, or something bought in a hurry that turns your
          skin green in a fortnight. We wanted a third option — pieces light
          enough to forget you are wearing, priced so that owning three is not a
          decision, and finished well enough that the third one still looks like
          the first.
        </p>
        <p>
          We started with waist chains because they are the piece people ask
          about most and find hardest to buy well. Bracelets, rings, earrings
          and pendants follow the same rule, and arrive as we photograph them.
          Everything we sell is non-gold by design: a gold or silver finish on
          stainless steel, which is what lets us price a piece at a few hundred
          taka instead of a few thousand.
        </p>
      </ProseSection>

      <ProseSection title="The thread">
        <p>
          There is a line running through the collection, and it is not an
          accident. Moons, starfish, shells and conches — celestial and
          nautical, things that keep turning up in the same jewellery box.
        </p>
        <p>
          Every piece comes in a gold or silver finish, and the ones that need
          to fit — the waist chains — carry an extender so one length works for
          more than one person. That is the whole idea: a small collection
          where every piece belongs with the others, whichever part of you it
          is made for.
        </p>
        <div className="not-prose mt-8 grid grid-cols-2 gap-4">
          <div>
            <ProductImage
              image={{ id: "story/celestial", alt: "Celestial pieces" }}
              sizes="(min-width: 640px) 20rem, 45vw"
              maxWidth={828}
              placeholderLabel="CELESTIAL"
            />
            <p className="text-stone-soft mt-2 text-xs">Moons and stars</p>
          </div>
          <div>
            <ProductImage
              image={{ id: "story/nautical", alt: "Nautical pieces" }}
              sizes="(min-width: 640px) 20rem, 45vw"
              maxWidth={828}
              placeholderLabel="NAUTICAL"
            />
            <p className="text-stone-soft mt-2 text-xs">Shells and the sea</p>
          </div>
        </div>
      </ProseSection>

      <ProseSection title="How we work">
        <p>
          We are small and we are honest about it. Orders are packed by hand,
          usually the same day, and sent by courier with cash on delivery
          anywhere in Bangladesh. If we are out of something we say so and offer
          a pre-order rather than taking your money and going quiet.
        </p>
        <p>
          We do not run fake discounts, we do not invent reviews, and we do not
          take payment for anything we cannot ship. If a piece arrives wrong or
          damaged we replace it and cover the courier both ways — see{" "}
          <Link href="/shipping">shipping and returns</Link> for exactly what
          that means.
        </p>
      </ProseSection>

      <ProseSection title="Care">
        <p>
          Plated jewellery lasts if you let it. Take it off before a shower, the
          pool or the sea; put it on after perfume and lotion rather than
          before; wipe it with a dry cloth and keep it in the pouch it arrived
          in. Done that way, a piece keeps its finish for a long time. Worn in
          the shower, it will not.
        </p>
      </ProseSection>

      <div className="not-prose border-line mt-12 flex flex-col gap-3 border-t pt-8 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <Link href="/shop">See the collection</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className="flex-1">
          <Link href="/contact">Talk to us</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
