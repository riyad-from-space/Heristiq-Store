import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
} from "@/components/ui/brand-icons";
import { Container, Eyebrow } from "@/components/ui/layout";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { footerNav, site } from "@/config/site";
import { displayPhone } from "@/lib/phone";

export function SiteFooter() {
  return (
    <footer className="bg-sea text-bone">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="font-display text-2xl tracking-[0.22em] uppercase">
              {site.name}
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-bone/70">
              {site.description}
            </p>

            <Eyebrow onDark className="mt-10">
              Newsletter
            </Eyebrow>
            <p className="mt-3 max-w-xs text-sm text-bone/70">
              New pieces and restocks, once or twice a month. Nothing else.
            </p>
            <NewsletterForm className="mt-4 max-w-xs" />
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {footerNav.map((group) => (
              <nav key={group.title}>
                <h2 className="text-eyebrow text-gold-wash/80 uppercase">
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-bone/75 decoration-bone/30 underline-offset-4 transition hover:text-bone hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <a
              href={site.social.instagram}
              aria-label="Heristiq on Instagram"
              className="text-bone/70 transition hover:text-bone"
            >
              <InstagramIcon size={18} />
            </a>
            <a
              href={site.social.tiktok}
              aria-label="Heristiq on TikTok"
              className="text-bone/70 transition hover:text-bone"
            >
              <TikTokIcon size={18} />
            </a>
            <a
              href={site.social.facebook}
              aria-label="Heristiq on Facebook"
              className="text-bone/70 transition hover:text-bone"
            >
              <FacebookIcon size={18} />
            </a>
            <span className="text-sm text-bone/50">
              {displayPhone(site.contact.phone)}
            </span>
          </div>
          <p className="text-xs text-bone/45">
            © {new Date().getFullYear()} {site.name}. Prices in Bangladeshi Taka.
          </p>
        </div>
      </Container>
    </footer>
  );
}
