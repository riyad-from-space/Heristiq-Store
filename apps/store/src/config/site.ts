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
  /* Names the CATEGORIES rather than one of them. This read "Waist chains in
     gold and silver finishes" while that was all there was; it is the site's
     meta description, so it is what Google shows under the name and what gets
     pasted into a WhatsApp link preview — telling someone looking for
     earrings that this shop sells something else. */
  description:
    "Waist chains, bracelets, rings, earrings and pendants in gold and silver finishes, made for everyday wear. Cash on delivery across Bangladesh.",
  url: "https://heristiq.com",
  locale: "en_BD",
  /*
   * The real accounts, confirmed by the owner.
   *
   * These are not just links in the footer: page.tsx feeds them to the
   * Organization schema as `sameAs`, which is how Google ties this site to
   * those profiles. A near-miss handle there is worse than no handle — it
   * claims a brand identity that belongs to someone else — so the strings are
   * exactly the canonical profile URLs, trailing slash and all.
   */
  social: {
    instagram: "https://www.instagram.com/heristiq_/",
    tiktok: "https://www.tiktok.com/@heristiq",
    facebook: "https://www.facebook.com/heristiqonlineshop",
  },
  /*
   * The Instagram @handle as a customer must TYPE it to tag the shop.
   *
   * Deliberately outside `social`, because page.tsx emits
   * `sameAs: Object.values(site.social)` into the Organization schema — a bare
   * handle in that array would be an invalid profile URL.
   *
   * It is also not derived from `site.name`, which is what it used to be. The
   * brand is "Heristiq" but the account is "heristiq_", and the three
   * platforms do not agree with each other either (tiktok is @heristiq,
   * facebook is heristiqonlineshop). The rendered copy said "Tag @heristiq"
   * while linking to heristiq_ — sending customers to tag an account that is
   * not this shop.
   */
  instagramHandle: "heristiq_",
  contact: {
    /* The number customers message. Also the WhatsApp/Messenger target.
       NOT the same as PATHAO_SENDER_PHONE, which is the number Pathao's
       pickup rider calls — that one is the owner's, this one is the shop's. */
    phone: "01345208555",
    email: "hello@heristiq.com",
    hours: "10am – 8pm, Saturday to Thursday",
  },
} as const;

/**
 * The Instagram row's tiles — Cloudinary ids, in the order they appear.
 *
 * EMPTY ON PURPOSE, and the row hides itself until this list has something in
 * it. These are customer photographs ("As worn by you"), so unlike the product
 * shots there is nothing to upload until people have actually worn the pieces
 * and tagged the shop.
 *
 * That is not merely tidiness. An id with no photograph behind it does NOT
 * fall back to the designed placeholder — it produces a request that 404s and
 * a browser's broken-image icon. This row asked for social/1…social/6
 * unconditionally, which stayed invisible for as long as Cloudinary was
 * unconfigured (no cloud name meant no URL, so the placeholder showed) and
 * turned into six broken tiles on the home page the moment real credentials
 * were added.
 *
 * To fill it: upload `social--1.jpg`, then add "social/1" here. Six is what
 * the six-column desktop layout expects; three fills the phone's grid.
 */
export const socialTiles: readonly string[] = [];

/**
 * Where the ERP lives, from the storefront's point of view.
 *
 * Default `/admin`, because both apps are served from one domain: Cloudflare
 * routes /admin* to the ERP Worker and everything else here, and the ERP is
 * built with a matching basePath. Until that route exists, point
 * NEXT_PUBLIC_ERP_URL at the ERP's workers.dev URL and the link still works.
 *
 * Read as a literal so the bundler can inline it — this is imported by client
 * components, so it cannot go through lib/env, which is `server-only`.
 */
export const erpUrl = process.env.NEXT_PUBLIC_ERP_URL || "/admin";

/**
 * The courier the shop actually ships with, as customers should read it.
 *
 * ONE PLACE, because this name appears on the home page, the product page and
 * the shipping page, and three hardcoded copies is three chances to be out of
 * date. They already were: all three said "Pathao, Steadfast or RedX" while
 * only Pathao had credentials, so the site named two couriers it could not
 * actually hand a parcel to.
 *
 * Steadfast and RedX are NOT removed — Steadfast is fully implemented and RedX
 * is stubbed, both still wired into lib/courier. Adding one back is setting its
 * credentials, pointing COURIER_DEFAULT at it, and changing this label; no
 * component has to be touched.
 *
 * Not derived from COURIER_DEFAULT: that is a server-only env var and this file
 * is imported by client components. A shop changes courier roughly never, and a
 * literal that a human edits beats a build-time inline nobody can see.
 */
export const courier = {
  label: "Pathao",
  /**
   * Which couriers a customer may choose between at checkout.
   *
   * ONE ENTRY MEANS NO CHOICE, and the checkout hides the picker entirely —
   * a radio group with a single option asks a question that has one answer.
   *
   * This is not cosmetic. Checkout offered Pathao, Steadfast and RedX while
   * only Pathao had credentials, and the choice is STORED: dispatch.ts resolves
   * `options.courier ?? order.courierPreference`, so a customer picking
   * Steadfast created an order that could not be pushed to anyone. The failure
   * would surface days later, in the ERP, on someone else's parcel.
   *
   * Adding a courier back is adding its key here and setting its credentials.
   * Keys must match COURIERS in lib/orders/types.ts.
   */
  choices: ["pathao"],
} as const;

/**
 * The payment methods the footer advertises.
 *
 * A CLAIM, not the mechanism. What a customer can actually choose at checkout
 * is decided by storefront_settings.payment: bKash and Nagad each appear only
 * once the owner has put a number in, because a wallet with nowhere to send
 * the money is a dead end. Cash on delivery is always offered.
 *
 * So this list exists to be MARKETING that matches reality, and it is a
 * literal rather than a read of those settings because the footer sits in the
 * root layout — making it async would pull a database read into every
 * prerendered page and turn /about and /policies dynamic for the sake of three
 * chips.
 *
 * IF YOU ENABLE NAGAD, add it back here. Nothing is removed to support it:
 * `manual_nagad` is a live payment method end to end, and putting a number in
 * ERP Settings is all it takes to offer it.
 */
export const paymentMethods = ["Cash", "bKash"] as const;

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
      { href: "/shop", label: "Everything" },
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

/**
 * Collections — "shop by mood".
 *
 * A third axis alongside finish and motif, and like both of those it lives in
 * the merchandising overlay rather than the ERP: inventory is about units and
 * cost, and which mood a piece belongs to is a selling decision the owner
 * changes without touching stock. (lib/erp/merchandising.ts explains the join;
 * the whole overlay moves to a storefront_products table in phase 6.)
 *
 * A piece belongs to as MANY moods as honestly apply — a fine plain chain is
 * both an everyday piece and one that layers — so a product carries a list,
 * not a single value.
 *
 * One copy deviation from the approved mockup, deliberately: its fourth tile
 * reads "Layered sets · Curated stacks, one order", which promises a bundle
 * SKU. There is no such product, and a tile that sells one would be a lie
 * that ends at an empty shop page. So the mood is the pieces that layer well,
 * and the subtitle says that instead.
 */
export const collections = {
  everyday: {
    label: "Everyday",
    blurb: "Light pieces, made to layer",
    lede: "The pieces that go on in the morning and are forgotten about until someone asks.",
  },
  occasion: {
    label: "Occasion",
    blurb: "Statement pieces for the night",
    lede: "More charm, more movement, more of a reason to be looked at twice.",
  },
  bridal: {
    label: "Bridal",
    blurb: "For the mehendi and beyond",
    lede: "Gold-finish pieces that sit with a saree or a lehenga, and keep working afterwards.",
  },
  layered: {
    label: "Layers",
    blurb: "Fine pieces made to stack",
    lede: "Slim pieces that sit together without crowding. Wear two, or wear four.",
  },
} as const;

export type CollectionKey = keyof typeof collections;
