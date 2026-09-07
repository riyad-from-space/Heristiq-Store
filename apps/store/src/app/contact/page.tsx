import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { ProsePage } from "@/components/site/prose";
import { ContactForm } from "@/components/site/contact-form";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { business } from "@/config/business";
import { site } from "@/config/site";
import { displayPhone, whatsappNumber } from "@/lib/phone";

/*
 * Contact.
 *
 * WhatsApp first, deliberately. This business already takes orders and answers
 * questions there, most customers arrive from Instagram with the app already
 * open, and a reply in two minutes beats a form that gets read tomorrow. The
 * form is for people who would rather not message a stranger — and it now
 * actually stores what they write.
 */
export const metadata: Metadata = {
  title: "Contact",
  description: `Message ${site.name} on WhatsApp, or send us a note. We reply within a day.`,
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({
  searchParams,
}: PageProps<"/contact">) {
  const params = await searchParams;
  const reference = typeof params.ref === "string" ? params.ref : "";

  const wa = whatsappNumber(site.contact.phone);

  return (
    <ProsePage
      eyebrow="Contact"
      title="Talk to us"
      lede={`WhatsApp is the fastest way to reach us — we are usually a few minutes away during opening hours. Everything else we answer within ${business.responseHours} hours.`}
      aside={
        <div className="not-prose grid gap-3 sm:grid-cols-2">
          {wa && (
            <Button asChild size="lg" variant="secondary">
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={18} />
                WhatsApp us
              </a>
            </Button>
          )}
          <Button asChild size="lg" variant="secondary">
            <a href={`tel:+88${site.contact.phone}`}>
              <Phone size={17} />
              Call {displayPhone(site.contact.phone)}
            </a>
          </Button>
        </div>
      }
    >
      <dl className="not-prose border-line grid gap-5 border-y py-6 text-sm sm:grid-cols-3">
        <div className="flex gap-3">
          <Clock size={17} className="text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
          <div>
            <dt className="font-medium">Open</dt>
            <dd className="text-ink-muted mt-1 leading-relaxed">
              {site.contact.hours}
            </dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Mail size={17} className="text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
          <div>
            <dt className="font-medium">Email</dt>
            <dd className="text-ink-muted mt-1 leading-relaxed break-all">
              <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
            </dd>
          </div>
        </div>
        <div className="flex gap-3">
          <MessageCircle
            size={17}
            className="text-gold mt-0.5 shrink-0"
            strokeWidth={1.6}
          />
          <div>
            <dt className="font-medium">Social</dt>
            <dd className="text-ink-muted mt-1 leading-relaxed">
              <a href={site.social.instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>{" "}
              ·{" "}
              <a href={site.social.facebook} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            </dd>
          </div>
        </div>
      </dl>

      <h3 className="mt-10">Common questions</h3>
      <p>
        Before you write — a few answers that save a message. Which length to
        take is in the <Link href="/size-guide">size guide</Link>. Delivery
        times, fees and what happens if something arrives wrong are in{" "}
        <Link href="/shipping">shipping and returns</Link>. To find an order you
        have already placed, use <Link href="/track">order tracking</Link>.
      </p>

      <div className="not-prose border-line mt-10 border-t pt-8">
        <h2 className="font-display text-display-s">Send us a message</h2>
        <p className="text-ink-muted mt-2 mb-6 text-sm leading-relaxed">
          Leave a phone number or an email and we will come back to you.
        </p>
        <ContactForm orderReference={reference} />
      </div>

      {business.address && (
        <p className="text-ink-faint mt-10 text-xs leading-relaxed">
          {business.legalName}, {business.address}
          {business.tradeLicence && ` · Trade licence ${business.tradeLicence}`}
        </p>
      )}
    </ProsePage>
  );
}
