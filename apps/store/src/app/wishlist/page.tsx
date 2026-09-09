import type { Metadata } from "next";
import { Container, SectionHeader } from "@/components/ui/layout";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";
import { erp } from "@/lib/erp";

/*
 * Saved pieces.
 *
 * A server shell that fetches the catalogue and hands it to a client grid,
 * which filters it against localStorage — see wishlist-grid.tsx for why the
 * split falls there rather than caching products in the browser.
 *
 * force-dynamic because the grid shows live prices and stock for whatever a
 * customer saved, and a piece selling out between the save and the visit is
 * precisely what this page should reflect.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved pieces",
  /* Nothing here is worth indexing — it is empty for everyone but its owner,
     and its content lives in that one browser. */
  robots: { index: false, follow: true },
};

export default async function WishlistPage() {
  const products = await erp().getProducts({ sort: "featured" });

  return (
    <Container className="py-section">
      <SectionHeader
        as="h1"
        size="l"
        eyebrow="Your list"
        title="Saved pieces"
        lede="Kept on this device, so there is nothing to sign in to. Prices and stock are live."
      />
      <WishlistGrid products={products} />
    </Container>
  );
}
