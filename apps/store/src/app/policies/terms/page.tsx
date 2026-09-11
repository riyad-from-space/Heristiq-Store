import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, ProseSection, LastUpdated } from "@/components/site/prose";
import { DraftNotice } from "@/components/site/draft-notice";
import { business } from "@/config/business";
import { site } from "@/config/site";

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
 * Terms.
 *
 * Short, and specific to how this shop actually operates: taka only, cash on
 * delivery, phone verification, a stock count that can be wrong between the
 * page loading and the order landing. Boilerplate copied from a template would
 * describe a different business and protect nobody.
 */
export const metadata: Metadata = {
  title: "Terms of sale",
  description: `The terms you buy under at ${site.name} — pricing, orders, delivery, cancellation and returns.`,
  alternates: { canonical: "/policies/terms" },
};

export default function TermsPage() {
  return (
    <ProsePage
      eyebrow="Policies"
      title="Terms of sale"
      lede={`These are the terms you buy under. They are deliberately short, and they describe how this shop really works.`}
      aside={<DraftNotice />}
    >
      <ProseSection title="Who you are buying from">
        <p>
          {business.legalName}
          {business.address && `, ${business.address}`}
          {business.tradeLicence && ` · Trade licence ${business.tradeLicence}`}
          {business.binNumber && ` · BIN ${business.binNumber}`}. Contact
          details are on <Link href="/contact">the contact page</Link>.
        </p>
      </ProseSection>

      <ProseSection title="Prices">
        <p>
          All prices are in Bangladeshi Taka and include any applicable tax.
          Delivery is charged separately and shown before you confirm — you
          will never be asked for more than the total on the order confirmation.
        </p>
        <p>
          A piece with no price shown is not yet for sale and cannot be added to
          a cart. Prices can change, but the price you see when you place an
          order is the price you pay: we snapshot it onto the order and we do
          not re-read it later.
        </p>
      </ProseSection>

      <ProseSection title="Placing an order">
        <p>
          Your order is an offer to buy. It becomes a contract when we confirm
          it, which we do by calling the number you gave us. We verify that
          number with a code first.
        </p>
        <p>
          We may decline an order — if a piece has just sold out, if the address
          is outside where our couriers deliver, or if a number cannot be
          reached. If you have paid anything up front and we decline, you get
          all of it back.
        </p>
        <h3>Stock</h3>
        <p>
          Stock counts are live but not instantaneous. Very occasionally the
          last piece is sold twice within the same minute; if that happens we
          will tell you straight away and offer a pre-order or a full refund of
          anything paid.
        </p>
      </ProseSection>

      <ProseSection title="Payment">
        <p>
          Cash on delivery: you pay the courier in cash on receipt. Where a
          pre-order advance or a small deposit is agreed, it is paid by bKash or
          Nagad and deducted from what you pay at the door.
        </p>
      </ProseSection>

      <ProseSection title="Delivery">
        <p>
          We deliver across Bangladesh by third-party courier. Times and fees
          are on <Link href="/shipping">the shipping page</Link>. Delivery times
          are estimates, not guarantees — the courier network is not ours to
          promise.
        </p>
        <p>
          Please be reachable on the number you gave us. Parcels that come back
          undelivered can be re-sent, with the second delivery fee payable up
          front.
        </p>
      </ProseSection>

      <ProseSection title="Cancelling">
        <p>
          You can cancel any time before the parcel is handed to the courier —
          message us and it is done, with anything paid refunded in full. After
          that, refuse the delivery or use the returns route below.
        </p>
      </ProseSection>

      <ProseSection title="Returns">
        <p>
          Faulty, damaged or wrong items: tell us within{" "}
          {business.returns.windowDays} days of delivery and we replace or
          refund, courier covered both ways.{" "}
          {business.returns.changeOfMind
            ? "Change-of-mind returns are accepted on unworn pieces."
            : "For hygiene reasons we cannot accept a change-of-mind return on body jewellery that has been worn."}{" "}
          The full detail is on <Link href="/shipping">the shipping page</Link>,
          and it is part of these terms.
        </p>
      </ProseSection>

      <ProseSection title="Our liability">
        <p>
          If we get something wrong we will put it right — replace the piece or
          refund what you paid, including delivery. Beyond that, our liability
          for any order is limited to what you paid for it. Nothing here limits
          any right you have under Bangladeshi consumer law, including under the
          Consumer Rights Protection Act 2009.
        </p>
      </ProseSection>

      <ProseSection title="Complaints and disputes">
        <p>
          Tell us first — most things are settled in one message. Write to{" "}
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> or
          use <Link href="/contact">the contact form</Link>, and we will reply
          within {business.responseHours} hours. These terms are governed by the
          laws of Bangladesh.
        </p>
      </ProseSection>

      <LastUpdated date="September 2026" />
    </ProsePage>
  );
}
