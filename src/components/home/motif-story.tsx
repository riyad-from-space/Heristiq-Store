import Link from "next/link";
import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";
import { ProductImage } from "@/components/ui/product-image";

/*
 * The motif story: where the moon, the starfish and the shell come from.
 *
 * This is the block that does the "premium, not discount" work. A shop grid
 * alone reads as a reseller page at any price point; a stated idea behind the
 * pieces is most of what separates Mejuri's feel from a marketplace listing.
 * So it gets a full section, real prose, and its own photograph.
 */
const threads = [
  {
    label: "Celestial",
    title: "The moon",
    body: "A crescent, hung so it sits at the hip rather than the navel. It is the piece the collection is named for, and the one that started it.",
    href: "/shop?motif=celestial",
    image: { id: "story/celestial", alt: "Silver crescent moon charm in close detail" },
  },
  {
    label: "Nautical",
    title: "The sea",
    body: "A starfish and a ridged conch, both hollow-cast so they stay light. Taken from the Bay, worn a long way inland.",
    href: "/shop?motif=nautical",
    image: { id: "story/nautical", alt: "Golden conch shell charm in close detail" },
  },
];

export function MotifStory() {
  return (
    <div className="bg-shell py-16 sm:py-24">
      <Container>
        <div className="max-w-xl">
          <Eyebrow>Where it comes from</Eyebrow>
          <SectionHeading className="mt-5">
            Two threads, sky and sea
          </SectionHeading>
          <p className="text-ink-muted mt-5 text-base leading-relaxed">
            Everything we make comes from one of two places. Nothing is gold, and
            nothing pretends to be — these are pieces to wear on a Tuesday, not
            to keep in a box for a wedding.
          </p>
        </div>

        <div className="mt-12 grid gap-8 sm:mt-16 sm:grid-cols-2 sm:gap-6">
          {threads.map((thread) => (
            <Link key={thread.label} href={thread.href} className="group block">
              <ProductImage
                image={thread.image}
                crop="square"
                sizes="(min-width: 640px) 46vw, 92vw"
                maxWidth={1080}
                className="transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
              <div className="mt-5">
                <span className="text-eyebrow text-gold uppercase">
                  {thread.label}
                </span>
                <h3 className="font-display mt-2 text-display-s decoration-line-strong underline-offset-4 group-hover:underline">
                  {thread.title}
                </h3>
                <p className="text-ink-muted mt-3 max-w-sm text-sm leading-relaxed">
                  {thread.body}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
}
