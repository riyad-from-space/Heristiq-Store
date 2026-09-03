import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";
import { deliveryTerms } from "@/lib/delivery.server";

/*
 * Checkout.
 *
 * A server shell that hands the form its delivery terms and nothing else. The
 * cart is in the browser, the validation and the pricing are in server actions
 * (app/checkout/actions.ts), so this page has no data of its own to fetch and
 * renders instantly.
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
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Container className="py-10 sm:py-16">
      <header className="max-w-xl">
        <Eyebrow>Almost there</Eyebrow>
        <SectionHeading as="h1" size="l" className="mt-5">
          Checkout
        </SectionHeading>
      </header>

      <div className="mt-10 sm:mt-14">
        <CheckoutForm terms={deliveryTerms()} />
      </div>
    </Container>
  );
}
