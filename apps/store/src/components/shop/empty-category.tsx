import Link from "next/link";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { ChainMotif } from "@/components/ui/chain-motif";
import { site } from "@/config/site";
import { whatsappNumber } from "@/lib/phone";

/*
 * A category with nothing in it yet.
 *
 * NOT the same thing as EmptyResults, which says "nothing matches that —
 * clear the filters". That copy is right when a customer has narrowed
 * themselves into a corner and wrong here: they have not made a mistake and
 * there are no filters to clear. Reusing it would have blamed the customer
 * for the shop's own empty shelf.
 *
 * The distinction is worth two components because these two states will look
 * completely different for months. Every category except waist chains is
 * empty until the pieces are photographed, so this is not a rare edge — for a
 * while it is four fifths of the catalogue, and it has to read as a shop
 * that is expanding rather than a page that is broken.
 *
 * Hence the WhatsApp button. This business already takes orders on WhatsApp,
 * so someone who wanted bracelets enough to tap the category is the single
 * most qualified visitor on the site, and an empty page that asks them a
 * question is worth more than one that apologises.
 */
export function EmptyCategory({ name }: { name: string }) {
  const wa = whatsappNumber(site.contact.phone);
  const lower = name.toLowerCase();

  return (
    <div className="border-line rounded-card border border-dashed px-6 py-16 text-center sm:py-20">
      {/*
       * The brand's own motif rather than a warning glyph. EmptyResults uses
       * an X because something failed; nothing has failed here.
       *
       * line-strong, not rose-soft. rose-soft (#f7e6e9) on the blush ground
       * (#fcf6f3) measures about 1.06:1 — I shipped that first and the motif
       * was invisible on screen, reading as a rendering artifact rather than
       * decoration. This is the token the design system already uses for
       * decorative rules on this ground.
       */}
      <ChainMotif className="text-line-strong mx-auto w-32" />

      <p className="font-display text-display-s mt-6">
        {name} are being photographed
      </p>

      <p className="text-stone mx-auto mt-3 max-w-sm text-sm">
        This part of the collection is on its way. Everything already in stock
        is on the shop page — or ask us what is coming and we will tell you
        first.
      </p>

      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/shop">See what is in stock</Link>
        </Button>

        {wa && (
          <Button asChild size="lg" variant="ghost">
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(
                `Hi Heristiq — when will you have ${lower}?`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={18} />
              Ask about {lower}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
