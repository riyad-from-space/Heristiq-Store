"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Banknote, Loader2, Lock } from "lucide-react";
import { placeOrderAction } from "@/app/checkout/actions";
import { useCart } from "@/components/cart/cart-provider";
import { AddressFields } from "@/components/checkout/address-fields";
import { Field, RadioCard, Textarea } from "@/components/checkout/fields";
import { OrderSummary } from "@/components/checkout/order-summary";
import { PhoneVerification } from "@/components/checkout/phone-verification";
import { Button } from "@/components/ui/button";
import { isInsideDhaka } from "@/lib/bd-geo";
import { deliveryFeeFor, type DeliveryTerms } from "@/lib/delivery";
import { hasUnpricedLine } from "@/lib/cart/types";
import { COURIERS, type CourierKey } from "@/lib/orders/types";
import { CHECKOUT_LIMITS } from "@/lib/orders/schema";
import type { LineProblem } from "@/lib/orders/place";

/*
 * Checkout, on one screen.
 *
 * One page and not a wizard, because a wizard on a phone is three chances to
 * abandon instead of one, and this form is short enough to scroll. The order of
 * the sections is the order the friction belongs in: the number we have to
 * verify first, then the address, then how they pay, then the button.
 *
 * State is plain React and validation is server-side only. There is one copy of
 * the rules, in lib/orders/schema.ts, and it is the copy that runs where it
 * matters — see the note in components/checkout/fields.tsx.
 *
 * What the client does NOT do is arithmetic that reaches the order. The fee
 * shown here comes from the same pure function the server uses, but the number
 * written to the database is the server's.
 */
type Form = {
  name: string;
  phone: string;
  divisionId: string;
  districtId: string;
  area: string;
  addressLine: string;
  landmark: string;
  courier: CourierKey | "";
  note: string;
};

const EMPTY: Form = {
  name: "",
  phone: "",
  divisionId: "",
  districtId: "",
  area: "",
  addressLine: "",
  landmark: "",
  courier: "",
  note: "",
};

export function CheckoutForm({ terms }: { terms: DeliveryTerms }) {
  const router = useRouter();
  const { cart, ready, subtotal, clear } = useCart();

  const [form, setForm] = useState<Form>(EMPTY);
  const [verified, setVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<LineProblem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (next: Partial<Form>) => {
    setForm((current) => ({ ...current, ...next }));
    /* Clearing the touched field's error as it is edited; leaving a stale
       "required" under a field someone just filled in reads as broken. */
    setErrors((current) => {
      const remaining = { ...current };
      for (const key of Object.keys(next)) delete remaining[key];
      return remaining;
    });
  };

  const insideDhaka = isInsideDhaka(form.districtId);
  const addressChosen = Boolean(form.districtId);
  const deliveryFee = addressChosen
    ? deliveryFeeFor(subtotal, insideDhaka, terms)
    : 0;

  if (!ready) return <div className="min-h-[50vh]" aria-busy="true" />;

  if (cart.lines.length === 0) {
    return (
      <div className="border-line border border-dashed px-6 py-16 text-center">
        <p className="font-display text-display-s">There is nothing to check out</p>
        <p className="text-ink-muted mt-2 text-sm">
          Your cart is empty.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/shop">Shop waist chains</Link>
        </Button>
      </div>
    );
  }

  /* An unpriced piece cannot be charged for, and the server refuses the order
     rather than guessing. Say so here instead of at the last tap. */
  if (hasUnpricedLine(cart)) {
    return (
      <div className="border-warn/40 bg-paper border px-6 py-10 text-center">
        <AlertTriangle size={22} className="text-warn mx-auto" />
        <p className="font-display mt-4 text-display-s">One piece is not priced yet</p>
        <p className="text-ink-muted mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          We cannot take payment for something without a price. Remove it from
          your cart and we will confirm the price over WhatsApp.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-8">
          <Link href="/cart">Back to cart</Link>
        </Button>
      </div>
    );
  }

  const submit = () => {
    setFormError(null);
    setProblems([]);

    startTransition(async () => {
      const result = await placeOrderAction({
        name: form.name,
        phone: form.phone,
        divisionId: form.divisionId,
        districtId: form.districtId,
        area: form.area,
        addressLine: form.addressLine,
        landmark: form.landmark,
        courier: form.courier === "" ? null : form.courier,
        paymentMethod: "cod",
        note: form.note,
        lines: cart.lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
        })),
      });

      if (result.ok) {
        /*
         * Clear the cart before navigating, not after. The confirmation page is
         * a server render; if the cart still had lines when the customer used
         * the back button they would be looking at a checkout for an order
         * that has already been placed.
         */
        clear();
        router.push(`/order/${result.token}`);
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setProblems(result.lineProblems ?? []);
      setFormError(result.error);
      if (result.needsVerification) setVerified(false);

      /* The error is above the button that was just pressed, and on a phone
         that is off-screen. */
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
      <form
        className="space-y-10"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
      >
        {formError && (
          <div
            role="alert"
            className="border-danger/40 bg-danger/5 text-danger border px-4 py-3 text-sm"
          >
            <p className="font-medium">{formError}</p>
            {problems.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {problems.map((problem) => (
                  <li key={problem.productId}>
                    <strong className="font-medium">{problem.name}</strong>{" "}
                    {problem.problem}
                  </li>
                ))}
              </ul>
            )}
            {problems.length > 0 && (
              <Link
                href="/cart"
                className="mt-3 inline-block text-sm underline underline-offset-4"
              >
                Edit your cart
              </Link>
            )}
          </div>
        )}

        <PhoneVerification
          name={form.name}
          phone={form.phone}
          onName={(name) => patch({ name })}
          onPhone={(phone) => patch({ phone })}
          verified={verified}
          onVerified={setVerified}
          errors={errors}
        />

        <AddressFields
          divisionId={form.divisionId}
          districtId={form.districtId}
          area={form.area}
          addressLine={form.addressLine}
          landmark={form.landmark}
          onChange={patch}
          errors={errors}
        />

        <section aria-labelledby="courier-heading">
          <h2 id="courier-heading" className="font-display text-display-s">
            Courier
          </h2>
          <p className="text-ink-muted mt-2 text-sm">
            No preference is usually fastest — we send it with whoever is
            covering your area that day.
          </p>
          <div className="mt-5 space-y-2">
            <RadioCard
              name="courier"
              value=""
              checked={form.courier === ""}
              onSelect={() => patch({ courier: "" })}
              label="Whoever gets there first"
              description="Recommended"
            />
            {Object.entries(COURIERS).map(([key, label]) => (
              <RadioCard
                key={key}
                name="courier"
                value={key}
                checked={form.courier === key}
                onSelect={() => patch({ courier: key as CourierKey })}
                label={label}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="font-display text-display-s">
            Payment
          </h2>
          <div className="mt-5">
            {/*
             * One option, and it is a radio anyway — bKash and Nagad arrive in
             * phase 5 and will sit beside it. Showing them greyed out now
             * would be advertising something that does not work.
             */}
            <RadioCard
              name="payment"
              value="cod"
              checked
              onSelect={() => {}}
              label="Cash on delivery"
              description="Pay the courier in cash when the parcel reaches you. Nothing now."
              icon={<Banknote size={18} className="text-gold shrink-0" />}
            />
          </div>

          <div className="mt-6">
            <Field
              label="Anything we should know"
              htmlFor="note"
              optional
              hint="A delivery time that suits you, gift wrapping, a different name on the parcel."
            >
              <Textarea
                id="note"
                name="note"
                value={form.note}
                onChange={(event) => patch({ note: event.target.value })}
                maxLength={CHECKOUT_LIMITS.note}
                placeholder="Please call before 6pm"
              />
            </Field>
          </div>
        </section>

        {/* The summary sits above the button on a phone, where the sidebar is
            below the form and would otherwise be read after the decision. */}
        <div className="lg:hidden">
          <OrderSummary
            cart={cart}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            insideDhaka={insideDhaka}
            addressChosen={addressChosen}
            terms={terms}
          />
        </div>

        <div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending || !verified}
          >
            {pending ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Placing your order
              </>
            ) : (
              <>
                <Lock size={15} />
                Place order
              </>
            )}
          </Button>

          {!verified && (
            <p className="text-ink-muted mt-3 text-center text-xs">
              Verify your mobile number to place the order.
            </p>
          )}
        </div>
      </form>

      <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        <OrderSummary
          cart={cart}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          insideDhaka={insideDhaka}
          addressChosen={addressChosen}
          terms={terms}
        />
      </aside>
    </div>
  );
}
