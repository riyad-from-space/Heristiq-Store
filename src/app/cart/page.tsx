import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";
import { deliveryTerms } from "@/lib/delivery.server";

/*
 * The cart page.
 *
 * A server shell around a client cart, whose only job is to hand down the
 * delivery terms — the fee and the free-delivery threshold are server config
 * (soon a storefront_settings row), and the cart needs them to render the
 * "add ৳x more for free delivery" nudge without shipping the env to the
 * browser.
 */
/*
 * Rendered per request rather than prerendered, and the reason is the delivery
 * fee. It comes from configuration the owner must be able to change without a
 * deploy; a statically generated page would bake in whatever the fee was at
 * build time and keep serving it. There is no cache to lose here — this page
 * has no content a crawler or another customer should see anyway.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart",
  /* Nothing here is worth indexing, and a crawler following it just burns
     budget on a page that is empty for everyone but its owner. */
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <Container className="py-10 sm:py-16">
      <header className="max-w-xl">
        <Eyebrow>Your bag</Eyebrow>
        <SectionHeading as="h1" size="l" className="mt-5">
          Cart
        </SectionHeading>
      </header>

      <div className="mt-10 sm:mt-14">
        <CartView terms={deliveryTerms()} />
      </div>
    </Container>
  );
}
