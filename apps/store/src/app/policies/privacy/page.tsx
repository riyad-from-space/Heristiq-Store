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
 * Privacy.
 *
 * Written from what the code ACTUALLY does, which is the only way a privacy
 * policy is worth anything. Every claim here is checkable against the
 * codebase: the OTP tables, the order tables, the courier hand-off, the absence
 * of any analytics or ad pixel. If the site later adds a tracker, this page is
 * wrong and has to change with it.
 */
export const metadata: Metadata = {
  title: "Privacy policy",
  description: `What ${site.name} collects, why, who it is shared with, and how to have it deleted.`,
  alternates: { canonical: "/policies/privacy" },
};

export default function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Policies"
      title="Privacy"
      lede="What we collect, why we collect it, and who else sees it. Written from what the site actually does."
      aside={<DraftNotice />}
    >
      <ProseSection title="What we collect">
        <p>When you place an order we collect:</p>
        <ul>
          <li>Your name, mobile number and delivery address</li>
          <li>What you ordered and what you paid</li>
          <li>
            A record that your phone number was verified, and when — not the
            code itself
          </li>
          <li>Any note you add to the order</li>
        </ul>
        <p>
          If you use the contact form we keep your name, your message, and the
          phone number or email you asked us to reply to. If you sign up to the
          newsletter we keep your email address and nothing else.
        </p>
        <h3>What we do not collect</h3>
        <p>
          We do not run analytics, advertising pixels or third-party trackers on
          this site. We do not collect card details, because we do not take card
          payments — cash on delivery means the money changes hands at your
          door. We never store your verification code, only a one-way hash of
          it, and only until it expires.
        </p>
      </ProseSection>

      <ProseSection title="Cookies">
        <p>
          This site sets one cookie, and only when you check out: a short-lived,
          signed record that your phone number was verified. It expires after 30
          minutes and carries nothing else. Your cart is kept in your own
          browser&apos;s storage, on your device, and is never sent to us until
          you place the order.
        </p>
        <p>There are no advertising or analytics cookies.</p>
      </ProseSection>

      <ProseSection title="Who else sees it">
        <ul>
          <li>
            <strong>The courier.</strong> Your name, phone number, address and
            the amount to collect — they cannot deliver without them. They are
            told what is in the parcel only as &ldquo;fashion
            accessory&rdquo;.
          </li>
          <li>
            <strong>Our SMS provider,</strong> to send you a verification code
            or a tracking update. They see your number and the message.
          </li>
          <li>
            <strong>Our hosting and database providers,</strong> who store the
            data on our behalf and do not use it for anything else.
          </li>
        </ul>
        <p>
          We do not sell your data, rent it, or share it with advertisers. If a
          courier&apos;s own fraud-check service is used to look up a phone
          number&apos;s delivery history before shipping, that lookup is the
          number only.
        </p>
      </ProseSection>

      <ProseSection title="How long we keep it">
        <p>
          Order records are kept as long as we are trading, because they are our
          accounts. Verification codes are deleted or expired within minutes.
          Newsletter subscriptions are kept until you unsubscribe.
        </p>
      </ProseSection>

      <ProseSection title="Your choices">
        <p>
          Message us and we will tell you what we hold about you, correct it, or
          delete it. We will keep the minimum an order record needs for our
          accounts and delete the rest. To stop marketing email, reply to any
          newsletter or ask us — one message is enough, you do not need a
          reason.
        </p>
        <p>
          The fastest route for any of this is{" "}
          <Link href="/contact">the contact page</Link>, or{" "}
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>. We
          reply within {business.responseHours} hours.
        </p>
      </ProseSection>

      <ProseSection title="Children">
        <p>
          This shop is not intended for children, and we do not knowingly
          collect anything from anyone under 13. If you believe we have, tell us
          and we will delete it.
        </p>
      </ProseSection>

      <LastUpdated date="September 2026" />
    </ProsePage>
  );
}
