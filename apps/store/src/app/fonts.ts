import { Fraunces, Hanken_Grotesk } from "next/font/google";

/*
 * The two typefaces, self-hosted by next/font at build time.
 *
 * Self-hosting is worth more to LCP on a 3G phone than any amount of CSS
 * tuning: there is no fonts.googleapis.com round trip, no second connection,
 * and no render-blocking stylesheet. The mockup loads them from the Google
 * CDN, which is correct for a static prototype and wrong for production.
 *
 * `display: swap` shows the fallback first rather than holding the hero
 * headline hostage to a font file — a blank hero is worse than one that
 * reflows once.
 *
 * Split into its own module rather than living in layout.tsx because the
 * design brief specifies it that way and because two files now need the
 * variables: the root layout, and global-error.tsx, which renders its own
 * <html> and cannot import from the layout it may be reporting a failure in.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  /*
   * No `weight` array: Fraunces is a variable font, so the weight axis comes
   * for free across the whole range and next/font rejects an explicit weight
   * alongside `axes`. SOFT and WONK are the optical axes globals.css sets in
   * font-variation-settings — the wonk is what stops it reading as Georgia.
   */
  axes: ["SOFT", "WONK", "opsz"],
});

export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  /* Also variable, so the same reasoning applies — 400 through 700 without
     shipping four separate files. */
});
