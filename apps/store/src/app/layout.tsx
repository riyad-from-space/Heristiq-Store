import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { CartProvider } from "@/components/cart/cart-provider";
import { PromoBanner } from "@/components/site/promo-banner";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { site } from "@/config/site";
import { promoSettings } from "@/lib/settings";
import "./globals.css";

/*
 * Fraunces for display, Inter for everything else.
 *
 * Both are self-hosted by next/font at build time, so there is no
 * fonts.googleapis.com round trip on a 3G phone — which is worth more to LCP
 * than any amount of CSS tuning. `display: swap` shows the fallback first
 * rather than holding the hero text hostage to a font file.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  /* No `weight`: Fraunces is variable, so the weight axis comes for free and
     next/font rejects an explicit weight alongside `axes`. SOFT and WONK are
     what globals.css sets in font-variation-settings. */
  axes: ["SOFT", "WONK", "opsz"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: { card: "summary_large_image" },
  /* No follow-up ask on a first visit; the theme colour is the page ground. */
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f2",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const promo = await promoSettings();

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        {/*
         * The no-JavaScript half of the scroll-reveal guardrail. (The
         * reduced-motion half is a media query in globals.css.)
         *
         * `motion` serialises an element's `initial` state into the HTML as an
         * inline style, so every revealing section ships at opacity 0 and
         * becomes visible when its animation runs. With JavaScript off or
         * blocked — a data-saver proxy, a corporate filter, a script error
         * earlier on the page — that animation never runs and the sections
         * stay invisible forever. The customer sees a header, a footer and
         * nothing in between.
         *
         * A <noscript> stylesheet is the one guard that works, because it is
         * evaluated by the same parser that would have skipped the script.
         */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html:
                "[data-reveal]{opacity:1!important;transform:none!important}",
            }}
          />
        </noscript>
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* The cart lives above the header, because the header renders its
            count. It is a client boundary, but a thin one: `children` stays a
            server tree and is passed through untouched. */}
        <CartProvider>
          {/*
           * Skip link. The header carries a menu button, a search link, a
           * wordmark and a cart before the page's own content, and on the shop
           * grid that is a lot of tabbing past for a keyboard or screen-reader
           * user on every single navigation.
           *
           * Visually hidden until focused, then it appears as a real button —
           * a skip link that stays invisible when focused is the classic
           * broken version of this.
           */}
          <a
            href="#main"
            className="bg-ink text-bone sr-only rounded-sm px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60]"
          >
            Skip to content
          </a>

          {/* Above the header, and the header's own offset accounts for it. */}
          <PromoBanner promo={promo} />
          <SiteHeader hasPromo={promo.enabled} />
          {/* pt-16/20 clears the fixed header. The home hero opts out of this
              by pulling itself back up, so it can sit under a transparent
              header. */}
          <main id="main" className="flex-1 pt-16 sm:pt-20">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
