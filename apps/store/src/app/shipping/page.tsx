import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, ProseSection, LastUpdated } from "@/components/site/prose";
import { business } from "@/config/business";
import { COURIERS } from "@/lib/orders/types";
import { deliveryTerms } from "@/lib/delivery.server";
import { dayRange, taka } from "@/lib/format";

/*
 * Shipping and returns.
 *
 * The fees and the delivery window are read from settings, not written into
 * the prose — the same source the cart, the PDP and the order total use. A
 * policy page quoting a fee the checkout no longer charges is the sort of
 * thing that ends in a chargeback argument.
 */
export const metadata: Metadata = {
  title: "Shipping & returns",
  description:
    "Delivery fees and times across Bangladesh, cash on delivery, and what happens if something arrives wrong.",
  alternates: { canonical: "/shipping" },
};

/* Fees come from the database, so this cannot be a static page. */
export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const terms = await deliveryTerms();

  return (
    <ProsePage
      eyebrow="Shipping & returns"
      title="Getting it to you"
      lede="We ship anywhere in Bangladesh, cash on delivery, by whichever courier covers your area fastest."
    >
      <ProseSection title="Delivery fees and times">
        <div className="not-prose overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead>
              <tr className="border-line text-eyebrow text-stone-soft border-b uppercase">
                <th scope="col" className="py-2 pr-4 font-medium">Where</th>
                <th scope="col" className="py-2 pr-4 font-medium">Time</th>
                <th scope="col" className="py-2 font-medium">Fee</th>
              </tr>
            </thead>
            <tbody className="tnum">
              <tr className="border-line border-b">
                <th scope="row" className="py-3 pr-4 font-medium">Inside Dhaka</th>
                <td className="text-stone py-3 pr-4">
                  {dayRange(terms.insideDays.min, terms.insideDays.max)}
                </td>
                <td className="py-3">{taka(terms.insideDhakaFee)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Outside Dhaka</th>
                <td className="text-stone py-3 pr-4">
                  {dayRange(terms.outsideDays.min, terms.outsideDays.max)}
                </td>
                <td className="py-3">{taka(terms.outsideDhakaFee)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {terms.freeThreshold > 0 && (
          <p className="not-prose bg-rose-soft text-rose-deep mt-5 px-4 py-3 text-sm">
            Delivery is free on orders over {taka(terms.freeThreshold)}.
          </p>
        )}
        <p className="mt-5">
          Savar, Keraniganj and Dhamrai are charged at the inside-Dhaka rate
          even though the couriers bill us a little more for them — the few taka
          is not worth quoting you one price and charging another.
        </p>
        <p>
          Times are working days from the day we hand the parcel over, which is
          usually the same day you order. Eid and heavy rain slow every courier
          in the country down; if something is late we will tell you rather than
          wait for you to ask.
        </p>
      </ProseSection>

      <ProseSection title="How you pay">
        <p>
          Three steps, and none of them is &ldquo;send money to a page you have
          never heard of&rdquo;.
        </p>
        <ol>
          <li>
            <strong>Pick your piece.</strong> Add it to the cart. Nothing is
            charged and nothing is reserved until you confirm.
          </li>
          <li>
            <strong>Confirm your number.</strong> We text a code to your
            mobile. It is how we make sure the parcel and the tracking link
            reach the right person.
          </li>
          <li>
            <strong>Pay the courier.</strong> Cash, at your door, when it
            arrives. Nothing in advance for anything we have in stock.
          </li>
        </ol>
        
        <p>
          <strong>Cash on delivery.</strong> You pay the courier in cash when
          the parcel reaches you. Nothing is charged when you place the order.
        </p>
        <p>
          We verify your phone number with a code before confirming a
          cash-on-delivery order. That is not us being difficult — undelivered
          parcels are the single biggest cost in this business, and one text
          keeps delivery affordable for everyone who does answer.
        </p>
      </ProseSection>

      <ProseSection title="Couriers and tracking">
        <p>
          We ship with {Object.values(COURIERS).join(", ")}. You get a tracking
          code by SMS when the parcel is collected, and you can follow it on{" "}
          <Link href="/track">the tracking page</Link> with your order number
          and the phone you ordered with.
        </p>
      </ProseSection>

      <ProseSection title="Pre-orders">
        <p>
          When a piece is sold out you can pre-order it. We confirm the restock
          date with you before taking anything, and the balance is paid to the
          courier on delivery like any other order. If the restock slips you can
          cancel and we refund any advance in full.
        </p>
      </ProseSection>

      <ProseSection title="If something is wrong">
        <p>
          Message us within{" "}
          <strong>{business.returns.windowDays} days of delivery</strong> with a
          photo if a piece arrives damaged, faulty, or is not what you ordered.
          We replace it and <strong>we cover the courier both ways</strong>. If
          a replacement is not possible we refund you in full, within{" "}
          {business.returns.refundDays} days of the piece coming back.
        </p>
        <h3>What we cannot take back</h3>
        <p>
          Body jewellery that has been worn, unless it is faulty. This is a
          hygiene rule, not a commercial one, and it is the same reason
          pierced-jewellery counters everywhere have it. So we would rather you
          asked us about length before ordering than sent something back after
          — the <Link href="/size-guide">size guide</Link> is there for that,
          and we will happily tell you which length to take if you send us your
          measurement.
        </p>
        <p>
          Plating that has worn after months of showers, perfume or the sea is
          wear, not a fault. <Link href="/about">How to avoid it</Link> is on
          the About page and on the card in the box.
        </p>
      </ProseSection>

      <ProseSection title="Refused and undelivered parcels">
        <p>
          If a parcel comes back because nobody answered the phone or the
          address was wrong, we will contact you to arrange a re-send. The
          second delivery fee is payable up front, because the courier charges
          us for both attempts.
        </p>
      </ProseSection>

      <LastUpdated date="September 2026" />
    </ProsePage>
  );
}
