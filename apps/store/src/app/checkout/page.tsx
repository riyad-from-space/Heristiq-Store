import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Container, SectionHeader } from "@/components/ui/layout";
import { deliveryTerms } from "@/lib/delivery.server";
import { paymentSettings } from "@/lib/settings";
import { verifiedPhone } from "@/lib/otp/session";
import { phoneVerificationEnabled } from "@/lib/otp/service";

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

export default async function CheckoutPage() {
  return (
    <Container className="py-10 sm:py-16">
      <SectionHeader as="h1" size="l" eyebrow="Almost there" title="Checkout" />

      <div className="mt-10 sm:mt-14">
        <CheckoutForm
          terms={await deliveryTerms()}
          payment={await paymentSettings()}
          /*
           * The verified number, read from the OTP session cookie.
           *
           * This is not a convenience — it is what makes verification stick.
           * verifyOtp writes that cookie from inside a server action, and
           * mutating cookies in an action makes Next refresh the route; on a
           * force-dynamic page that remounts this form and threw away the
           * `verified` boolean it was holding in useState. The customer
           * verified successfully, watched the code field vanish, and was
           * told to verify their number to place the order — with the Place
           * order button disabled. No order could be completed through the
           * UI at all.
           *
           * Passing it down makes the remount harmless: the cookie was always
           * the source of truth (lib/orders/place.ts re-checks it server-side
           * before writing anything), so the UI now reflects it instead of
           * tracking a second, losable copy of the same fact.
           */
          verifiedPhone={await verifiedPhone()}
          /*
           * False when no SMS gateway is configured. The checkout then drops
           * the OTP step rather than asking for a code that reached nobody —
           * see phoneVerificationEnabled(). The order is recorded unverified
           * and the ERP flags it for a confirmation call.
           */
          verificationRequired={phoneVerificationEnabled()}
        />
      </div>
    </Container>
  );
}
