import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose";
import { SizeGuideContent } from "@/components/product/size-guide";
import { Button } from "@/components/ui/button";

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
    "How to measure for a waist chain, and which length to choose. Measurements in inches and centimetres.",
  alternates: { canonical: "/size-guide" },
};

export default function SizeGuidePage() {
  return (
    <ProsePage
      eyebrow="Fit"
      title="Finding your length"
      lede="A waist chain is the one piece where the wrong length means sending it back, so it is worth two minutes with a tape measure — or a phone charging cable, which is what most people have."
    >
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
