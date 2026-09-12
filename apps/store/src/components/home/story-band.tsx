import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/ui/layout";
import { ProductImage } from "@/components/ui/product-image";
import { editorial } from "@/config/site";

/*
 * The story band — the one dark, deliberate break in the page.
 *
 * The copy is Heristiq's own, not the mockup's. The mockup reads "Heristiq
 * started with one idea: modern body jewellery that isn't locked in a safe",
 * which is a good line and is also placeholder text written about a brand in
 * the abstract. The real version of that idea already existed in the site's
 * motif-story section — "nothing is gold, and nothing pretends to be; these
 * are pieces to wear on a Tuesday, not to keep in a box for a wedding" — and
 * it says the same thing more specifically, about this shop's actual
 * positioning against gold jewellery in Bangladesh.
 *
 * So the SHAPE is the mockup's exactly: plum ground, rose kicker, a heading
 * whose emphasised italic word is rose, body at ~80% opacity, a light ghost
 * button, media first on a phone. The words are the ones that are true.
 *
 * This replaces both the old sand-coloured motif story and the plum ordering
 * band that used to sit here. The ordering steps were not in the approved
 * design and now live on /shipping, where "how ordering works" belongs
 * anyway — they are not deleted, just moved somewhere a customer looking for
 * them would think to look.
 */
export function StoryBand() {
  return (
    <Section tone="inverted" as="div" className="overflow-hidden">
      <Container className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <div className="order-first">
          {/*
           * The editorial shot, not the old product-on-denim one.
           *
           * The words beside it argue that these pieces are for an ordinary
           * evening rather than a locked box, and a flat-lay on a bed cannot
           * carry that. A chain poured over a wine glass in lamplight is the
           * evening — it makes the claim the paragraph then explains.
           *
           * story/celestial is not orphaned; it still opens /about, where a
           * close product study is exactly right.
           */}
          <ProductImage
            image={editorial.glass}
            sizes="(min-width: 1024px) 46vw, 100vw"
            /* 4:5 rather than the old 5:4 letterbox: the subject is a tall
               glass with the chain falling past its stem, and a landscape crop
               cut the fall off at the tabletop. */
            crop="portrait"
            maxWidth={1080}
            className="rounded-media"
          />
        </div>

        <div>
          <Eyebrow onDark>Made in Bangladesh, made by hand</Eyebrow>

          <SectionHeading size="l" className="text-on-inverted mt-4">
            Nothing is gold, and nothing{" "}
            <em className="text-rose font-normal italic">pretends</em> to be.
          </SectionHeading>

          <p className="text-copy-lg text-on-inverted/80 mt-5 max-w-[48ch]">
            Heristiq started with one idea: body jewellery that is not kept in a
            box for a wedding. Rhodium and gold-plated brass, nickel-free,
            finished by hand in small batches — priced to wear on a Tuesday,
            and made to be worn again on Wednesday.
          </p>

          <Button asChild variant="ghostLight" size="lg" className="mt-7">
            <Link href="/about">Read our story</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
