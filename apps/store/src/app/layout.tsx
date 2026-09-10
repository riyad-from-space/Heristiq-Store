import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/cart/cart-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { ToastProvider } from "@/components/ui/toast";
import { PromoBanner } from "@/components/site/promo-banner";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { site } from "@/config/site";
import { promoSettings } from "@/lib/settings";
import { erp } from "@/lib/erp";
import { fraunces, hanken } from "./fonts";
import "./globals.css";

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
  /*
   * One colour, not a per-scheme pair: this design is light-only, so the
   * browser chrome above the page should always match the blush base. (The
   * parked dark palette would restore the media-query form — see the note at
   * the top of globals.css.)
   */
  themeColor: "#fcf6f3",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /*
   * The category menu is fetched HERE, in the layout, rather than per page.
   *
   * It appears in the header on every route, so fetching it in each page
   * would be the same read repeated by /shop, every category, every product
   * and the cart. getCategories() returns [] on failure by design, so a
   * taxonomy read that fails degrades the menu instead of the layout.
   */
  const [promo, categories] = await Promise.all([
    promoSettings(),
    erp().getCategories(),
  ]);

  return (
    /*
     * No suppressHydrationWarning any more, and that is deliberate: nothing
     * mutates <html> before React sees it now that the pre-paint theme script
     * is gone, so the prop would only be hiding future real mismatches.
     */
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <head>
        {/*
         * The no-JavaScript half of the entrance-animation guardrail. (The
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
        <ToastProvider>
        <CartProvider>
        <WishlistProvider>
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
            className="bg-ink text-on-inverted sr-only rounded-pill px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60]"
          >
            Skip to content
          </a>

          {/* Above the header, and the header's own offset accounts for it. */}
          <PromoBanner promo={promo} />
          <SiteHeader hasPromo={promo.enabled} categories={categories} />
          {/* pt-16/20 clears the fixed header. The home hero opts out of this
              by pulling itself back up, so it can sit under a transparent
              header. */}
          <main id="main" className="flex-1 pt-16 sm:pt-20">{children}</main>
          <SiteFooter />
        </WishlistProvider>
        </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
