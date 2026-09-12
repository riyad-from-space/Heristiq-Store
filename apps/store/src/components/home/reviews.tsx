import Link from "next/link";
import { Star } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { Button } from "@/components/ui/button";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import { reviews } from "@/config/reviews";
import { site } from "@/config/site";
import { whatsappNumber } from "@/lib/phone";
import type { ProductCard } from "@/lib/erp/types";

/*
 * What customers said — or, until they have, an honest invitation to say it.
 *
 * TWO STATES, ON PURPOSE. `config/reviews.ts` is empty, because there are no
 * reviews in this system and /about promises the shop does not invent them.
 * Writing five plausible quotes with first names and five stars would have
 * filled this band in ten minutes and made that promise the most obvious lie
 * on the site — and a shop caught inventing its reviews has nothing left to
 * say when the real ones arrive.
 *
 * So: with reviews, this is a review wall. Without, it is a short band asking
 * for the first one, which is a real thing to say to a real customer and the
 * fastest way to stop it being empty. Both carry the same anchor, so the
 * header link has somewhere to land either way.
 *
 * It is a Server Component and a plain grid rather than a carousel. A slider
 * hides most of what it holds behind a control nobody presses, and at three or
 * four reviews there is nothing to hide — a grid shows all of them at once, on
 * a phone as well, with no JavaScript.
 */
export function Reviews({ products }: { products: ProductCard[] }) {
  const bySku = new Map(products.map((p) => [p.sku, p]));

  if (reviews.length === 0) {
    return (
      <Section as="div" id="reviews">
        <Container>
          <div className="border-line rounded-media bg-sand/60 border px-6 py-10 text-center sm:px-10 sm:py-14">
            <SectionHeader
              align="center"
              eyebrow="Customers"
              title="The first review is not written yet"
              lede="Everything here is new, and so is the shop. If you have worn a piece, tell us what it is actually like — we would rather publish one honest sentence than five invented ones."
            />
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <a
                  href={`https://wa.me/${whatsappNumber(site.contact.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Send us a review
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/shop">Shop the collection</Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    );
  }

  const average =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <Section as="div" id="reviews" tone="sand">
      <Container>
        <SectionHeader
          eyebrow="Customers"
          title="Worn, and reported back"
          lede={`${average.toFixed(1)} out of 5 across ${reviews.length} ${
            reviews.length === 1 ? "review" : "reviews"
          } — every one of them sent to us by the person who bought the piece.`}
        />

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => {
            const piece = review.sku ? bySku.get(review.sku) : undefined;
            /* Their own photograph if they sent one, else the piece they are
               talking about. Never a stock image of a stranger. */
            const image = review.photo
              ? { id: review.photo, alt: `${review.name}'s photograph` }
              : piece?.images[0];

            return (
              <li
                key={`${review.name}-${index}`}
                className="border-line rounded-card flex flex-col overflow-hidden border bg-white"
              >
                {image && (
                  <ProductImage
                    image={image}
                    sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
                    crop="portrait"
                    maxWidth={828}
                    className="aspect-[4/3.2]"
                  />
                )}

                <div className="flex flex-1 flex-col p-5">
                  <div
                    className="flex gap-0.5"
                    role="img"
                    aria-label={`${review.rating} out of 5`}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        aria-hidden
                        className={
                          i < review.rating
                            ? "fill-rose text-rose"
                            : "text-line-strong"
                        }
                      />
                    ))}
                  </div>

                  <blockquote className="text-copy-sm mt-3 flex-1 leading-relaxed">
                    “{review.quote}”
                  </blockquote>

                  <footer className="text-stone mt-4 text-[0.8rem]">
                    <span className="text-ink font-semibold">{review.name}</span>
                    {piece && (
                      <>
                        {" · "}
                        <Link
                          href={`/shop/${piece.slug}`}
                          className="decoration-line-strong underline underline-offset-2 hover:decoration-current"
                        >
                          {piece.name}
                        </Link>
                      </>
                    )}
                  </footer>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
