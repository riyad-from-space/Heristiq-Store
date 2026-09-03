/**
 * Brand-level constants that are copy, not configuration — safe in the client
 * bundle and safe to import anywhere. Anything the owner needs to change
 * without a deploy (prices, delivery fees, promo banners) does NOT belong here;
 * it belongs in storefront_settings.
 */

export const site = {
  name: "Heristiq",
  /* Used as the <title> suffix and in structured data. */
  tagline: "Modern body jewellery",
  description:
    "Waist chains in gold and silver finishes, made for everyday wear. Cash on delivery across Bangladesh.",
  url: "https://heristiq.com",
  locale: "en_BD",
  /* Placeholders until the real accounts are confirmed. */
  social: {
    instagram: "https://instagram.com/heristiq",
    tiktok: "https://tiktok.com/@heristiq",
    facebook: "https://facebook.com/heristiq",
  },
  contact: {
    /* The number customers message. Also the WhatsApp/Messenger target. */
    phone: "01712345678",
    email: "hello@heristiq.com",
    hours: "10am – 8pm, Saturday to Thursday",
  },
} as const;

export const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?finish=gold", label: "Gold" },
  { href: "/shop?finish=silver", label: "Silver" },
  { href: "/about", label: "Our story" },
] as const;

export const footerNav = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All waist chains" },
      { href: "/shop?finish=gold", label: "Gold finish" },
      { href: "/shop?finish=silver", label: "Silver finish" },
      { href: "/shop?motif=celestial", label: "Celestial" },
      { href: "/shop?motif=nautical", label: "Nautical" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/track", label: "Track your order" },
      { href: "/shipping", label: "Shipping & returns" },
      { href: "/size-guide", label: "Size guide" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Heristiq",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/policies/privacy", label: "Privacy" },
      { href: "/policies/terms", label: "Terms" },
    ],
  },
] as const;

/**
 * The celestial / nautical thread the catalogue is built on. Motifs are a
 * merchandising dimension, not a database category — the ERP's `categories`
 * table stays about stock, and this stays about how the site tells the story.
 */
export const motifs = {
  celestial: {
    label: "Celestial",
    blurb: "Moons and stars, worn low.",
  },
  nautical: {
    label: "Nautical",
    blurb: "Shells, starfish, the sea.",
  },
  oval: {
    label: "Oval link",
    blurb: "The plain chain, done properly.",
  },
} as const;

export type MotifKey = keyof typeof motifs;

export const finishes = {
  gold: { label: "Gold", swatch: "#c9a869" },
  silver: { label: "Silver", swatch: "#c9c9c9" },
} as const;

export type FinishKey = keyof typeof finishes;
