import type { Metadata } from "next";
import { TrackForm } from "@/components/track/track-form";
import { Container, SectionHeader } from "@/components/ui/layout";

/*
 * Track an order.
 *
 * Renders the NORMALISED status — the same five-step rail whichever courier is
 * carrying the parcel. See lib/courier/status.ts; the components here cannot
 * tell Steadfast from Pathao, which is the point.
 *
 * Dynamic because the lookup is a server action against live courier state,
 * and because a cached copy of this page is a cached copy of someone's order.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Follow your Heristiq parcel from pickup to delivery with your order number.",
  alternates: { canonical: "/track" },
  /* Indexable — people search for it — but never cached by a crawler. */
  robots: { index: true, follow: true, nocache: true },
};

export default async function TrackPage({ searchParams }: PageProps<"/track">) {
  const params = await searchParams;
  const reference = params.ref;

  return (
    <Container width="prose" className="py-10 sm:py-16">
      <SectionHeader
        as="h1"
        size="l"
        eyebrow="Where is it"
        title="Track your order"
        lede="Your order number and the mobile number you ordered with. We ask for both so nobody else can look up your delivery."
      />

      <div className="mt-10">
        <TrackForm
          initialReference={
            typeof reference === "string" ? reference : ""
          }
        />
      </div>
    </Container>
  );
}
