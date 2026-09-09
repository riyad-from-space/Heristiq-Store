import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
  WhatsAppIcon,
} from "@/components/ui/brand-icons";
import { Container } from "@/components/ui/layout";
import { erpUrl, footerNav, site } from "@/config/site";
import { displayPhone, whatsappNumber } from "@/lib/phone";

/*
 * The footer.
 *
 * Four columns per the mockup: the brand blurb and socials, then the three
 * link lists. The newsletter USED to be the second half of that first column,
 * squeezed under the blurb; it has its own sand-coloured section on the home
 * page now, which is where the mockup puts it and where it actually reads as
 * an ask rather than as furniture.
 *
 * The socials are circles with a hairline that fill rose on hover, and the
 * bottom row carries the "pay on delivery" chips — Cash, bKash, Nagad. Those
 * chips are the last trust signal on the page, and for a cash-on-delivery
 * shop they are worth more than a row of card logos would be.
 */
export function SiteFooter() {
  const wa = whatsappNumber(site.contact.phone);

  const socials = [
    { href: site.social.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: site.social.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: site.social.tiktok, label: "TikTok", Icon: TikTokIcon },
    ...(wa
      ? [
          {
            href: `https://wa.me/${wa}`,
            label: "WhatsApp",
            Icon: WhatsAppIcon,
          },
        ]
      : []),
  ];

  return (
    <footer className="bg-inverted text-on-inverted/80">
      <Container className="pt-section pb-7">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-10">
          {/* The brand column spans the row on a phone, per the mockup. */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="font-display text-on-inverted text-[1.9rem] font-semibold">
              {site.name}
              <span className="text-rose">.</span>
            </p>
            <p className="text-copy-sm mt-4 max-w-[34ch]">
              {site.description}
            </p>

            <div className="mt-5 flex gap-2.5">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={`${site.name} on ${label}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-on-inverted/25 text-on-inverted hover:bg-rose hover:border-rose duration-quick ease-out-soft grid size-10 place-items-center rounded-full border transition-colors hover:text-white"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          {footerNav.map((group) => (
            <nav key={group.title}>
              <h2 className="text-eyebrow text-on-inverted font-bold uppercase">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-copy-sm hover:text-rose duration-quick transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-on-inverted/15 text-copy-xs text-on-inverted/60 mt-11 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-5">
            <span>
              © {new Date().getFullYear()} {site.name}. Handmade in Bangladesh.
            </span>
            <a
              href={`tel:+880${site.contact.phone.slice(1)}`}
              className="hover:text-rose w-fit transition-colors"
            >
              {displayPhone(site.contact.phone)}
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span>Pay on delivery</span>
            {["Cash", "bKash", "Nagad"].map((method) => (
              <span
                key={method}
                className="bg-on-inverted/10 text-on-inverted rounded-[6px] px-2.5 py-1 text-[0.72rem] font-semibold"
              >
                {method}
              </span>
            ))}
          </div>
        </div>

        {/*
         * The owner's way in, from the site itself rather than a remembered
         * workers.dev URL.
         *
         * Quiet on purpose — it is not for customers — but not hidden either:
         * security here is the ERP's Supabase login, not the obscurity of the
         * link, and a door nobody can find is a door the owner cannot find on
         * a phone at a stall.
         */}
        <a
          href={erpUrl}
          className="text-on-inverted/30 hover:text-on-inverted/60 duration-quick mt-5 block w-fit text-[0.6875rem] transition-colors"
        >
          Owner sign-in
        </a>
      </Container>
    </footer>
  );
}
