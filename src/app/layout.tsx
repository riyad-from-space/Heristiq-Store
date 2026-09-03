import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { site } from "@/config/site";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        {/* pt-16/20 clears the fixed header. The home hero opts out of this by
            pulling itself back up, so it can sit under a transparent header. */}
        <main className="flex-1 pt-16 sm:pt-20">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
