import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose";
import { SizeGuideContent } from "@/components/product/size-guide";
import { Button } from "@/components/ui/button";

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
 * The size guide, as its own page.
 *
 * The table itself is the same component the PDP accordion renders — which is
 * why size-guide.tsx exported it in the first place. Two copies of these
 * numbers would be two chances to get a customer's fit wrong.
 */
export const metadata: Metadata = {
  title: "Size guide",
  description:
    "How to measure for a waist chain and choose a length, in inches and centimetres. Fit notes for bracelets, rings, earrings and pendants arrive with those pieces.",
  alternates: { canonical: "/size-guide" },
};

export default function SizeGuidePage() {
  return (
    <ProsePage
      eyebrow="Fit"
      title="Finding your length"
      lede="A waist chain is the one piece where the wrong length means sending it back, so it is worth two minutes with a tape measure — or a phone charging cable, which is what most people have."
    >
      {/*
       * WAIST CHAINS ONLY, and it says so rather than quietly implying the
       * numbers cover everything.
       *
       * The shop now lists five categories, but this page teaches one thing:
       * where to hold a tape measure on your hip. Writing a ring chart or an
       * earring guide for pieces nobody has photographed yet would be
       * inventing sizing for products that do not exist — and a wrong ring
       * size is a return, which is the exact cost this page is here to avoid.
       *
       * So the scope is stated, and the other categories get their section
       * when there is something real to measure.
       */}
      <p className="text-stone text-copy-sm">
        This page covers <strong className="text-ink font-medium">waist
        chains</strong>. Bracelets, rings, earrings and pendants have their own
        fit notes, which arrive on each piece as we photograph it — and until
        then, ask us and we will measure one by hand.
      </p>

      <SizeGuideContent />

      <div className="border-line mt-12 border-t pt-8">
        <h3>Still not sure?</h3>
        <p>
          Send us your measurement on WhatsApp and we will tell you which length
          to take. It is faster than guessing and cheaper than a return.
        </p>
        <Button asChild variant="ghost" className="mt-5">
          <Link href="/contact">Ask us</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
