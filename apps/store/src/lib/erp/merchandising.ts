import type { CollectionKey, FinishKey, MotifKey } from "@/config/site";

/*
 * Editorial overlay, keyed by ERP SKU.
 *
 * The ERP knows a product's sku, name, price and stock. It does not know — and
 * should not have to know — its finish, its motif, how it is described, or how
 * long the chain is. Inventory is about units and cost; this is about how the
 * piece is sold.
 *
 * So the catalogue is a JOIN: ERP row (truth about price and stock) + this row
 * (truth about the story). Both clients, mock and real, go through it, which is
 * why a fresh clone with no credentials still renders a complete-looking shop.
 *
 * This moves to a `storefront_products` table in phase 6 so the owner can edit
 * copy without a deploy. The shape below is already the table's shape, so that
 * migration is a data move and not a refactor.
 */

export type Merchandising = {
  slug: string;
  tagline: string;
  description: string;
  finish: FinishKey;
  /*
   * NULLABLE, because the motifs are waist-chain vocabulary — celestial is
   * moons and stars, nautical is shells, oval is "the plain chain, done
   * properly". None of them describes a flower bracelet, and labelling one
   * "Oval link" to satisfy a type would put a wrong word on the page and a
   * wrong piece in the /shop?motif=oval filter.
   *
   * Product.motif was already `MotifKey | null`; this makes the source agree
   * with it. A piece with no motif simply does not appear under any motif.
   */
  motif: MotifKey | null;
  /*
   * Which moods this piece belongs to — see `collections` in config/site.ts.
   * A list, not one value: a fine plain chain is honestly both an everyday
   * piece and one that layers, and forcing a single choice would make one of
   * those tiles thinner than it should be.
   */
  collections: readonly CollectionKey[];
  /*
   * NULL means "this piece has no length to state" — a free-size bracelet, a
   * ring, an earring. It is not the same as "we have not measured it yet",
   * and the PDP treats it correctly either way: the Length & fit panel is
   * gated on this, so null simply hides a panel that would otherwise tell a
   * bracelet customer to measure their hip.
   */
  lengthInches: { min: number; max: number } | null;
  materials: string;
  featured: boolean;
  position: number;
  /**
   * Cloudinary public IDs, first is the hero. Empty renders the placeholder.
   *
   * NOW A FALLBACK, not the source of truth. Since migration 1009 the owner
   * uploads photographs on the product page in the ERP, and those are stored
   * in `product_images` — if a product has any rows there, they replace this
   * list wholesale. This is what a product shows until someone uploads
   * something for it, which is why the ids below are still correct and still
   * checked by `npm run images:check`.
   *
   * ONLY LIST PHOTOGRAPHS THAT HAVE ACTUALLY BEEN UPLOADED. An id here that
   * is not in Cloudinary is not a placeholder — the placeholder only appears
   * when the list is empty. A missing id produces a real request that 404s,
   * so the customer gets a broken image instead of the designed stand-in.
   *
   * Each piece currently has one photograph, its front. The `worn` and
   * `detail` shots the layout supports are commented out per product rather
   * than deleted, so restoring one after a shoot is uncommenting a line:
   * upload `wc-005--worn.jpg`, uncomment, done. `npm run images:check`
   * verifies the two lists agree.
   */
  images: { id: string; alt: string }[];
};

const CHAIN_MATERIAL =
  "Rhodium or gold-plated brass, nickel-free. Not gold — priced to wear, not to keep in a box.";

const GOLD_PLATE =
  "Gold-plated brass, nickel-free. Not gold — priced to wear, not to keep in a box.";

export const MERCHANDISING: Record<string, Merchandising> = {
  "WC-001": {
    slug: "oval-link-waist-chain-silver",
    tagline: "Alternating oval links, silver finish.",
    description:
      "Large and small ovals alternate the whole way round, so the chain catches light at two different rhythms as you move. The plainest piece we sell, and the one that goes with everything.",
    finish: "silver",
    motif: "oval",
    collections: ["everyday", "layered"],
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 30,
    images: [
      {
        id: "wc-001/front",
        alt: "Silver oval-link waist chain draped over the back pocket of dark denim jeans",
      },
      // { id: "wc-001/worn", alt: "Silver oval-link waist chain worn at the hip" },
    ],
  },
  "WC-002": {
    slug: "oval-link-waist-chain-gold",
    tagline: "Alternating oval links, gold finish.",
    description:
      "The same alternating ovals in a warm gold finish. Worn low over linen or denim, it reads as jewellery rather than as a belt.",
    finish: "gold",
    motif: "oval",
    collections: ["bridal", "occasion"],
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 10,
    images: [
      {
        id: "wc-002/front",
        alt: "Gold oval-link waist chain curving across the waistband and back pocket of dark denim jeans",
      },
      // { id: "wc-002/worn", alt: "Gold oval-link waist chain worn at the hip" },
    ],
  },
  "WC-003": {
    slug: "long-oval-waist-chain-silver",
    tagline: "Elongated links, silver finish.",
    description:
      "Longer links mean fewer of them, and a cleaner line. The most restrained chain in the collection — barely there until it isn't.",
    finish: "silver",
    motif: "oval",
    collections: ["everyday", "layered"],
    lengthInches: { min: 30, max: 36 },
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 40,
    images: [
      {
        id: "wc-003/front",
        alt: "Silver long-oval waist chain laid across the waistband of dark denim jeans on cream cloth",
      },
    ],
  },
  "WC-004": {
    slug: "long-oval-waist-chain-gold",
    tagline: "Elongated links, gold finish.",
    description:
      "Long gold ovals with enough weight to sit still. Our easiest first piece, and the one most people come back for in silver.",
    finish: "gold",
    motif: "oval",
    collections: ["bridal", "everyday"],
    lengthInches: { min: 30, max: 36 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 20,
    images: [
      {
        id: "wc-004/front",
        alt: "Gold long-oval waist chain curved over the back pocket of dark denim jeans",
      },
      // { id: "wc-004/worn", alt: "Gold long-oval waist chain worn at the hip" },
    ],
  },
  "WC-005": {
    slug: "silver-moon-waist-chain",
    tagline: "A crescent, hung off silver.",
    description:
      "A single crescent moon drops from a fine silver chain and settles at the hip. The piece the rest of the collection is named after.",
    finish: "silver",
    motif: "celestial",
    collections: ["occasion", "everyday"],
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 1,
    images: [
      {
        id: "wc-005/front",
        alt: "Silver crescent-moon and star waist chain over the back pocket of dark denim jeans",
      },
      // { id: "wc-005/detail", alt: "Close detail of the crescent moon charm" },
      // { id: "wc-005/worn", alt: "Silver moon waist chain worn at the hip" },
    ],
  },
  "WC-006": {
    slug: "golden-starfish-waist-chain",
    tagline: "A starfish, cast in gold.",
    description:
      "Five arms, textured across the top, smooth underneath so it lies flat against skin. Somewhere between the sea and the sky, which is the whole idea.",
    finish: "gold",
    motif: "nautical",
    collections: ["occasion"],
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 2,
    images: [
      {
        id: "wc-006/front",
        alt: "Gold starfish waist chain curving across cream cloth and dark denim jeans",
      },
      // { id: "wc-006/detail", alt: "Close detail of the textured starfish charm" },
    ],
  },
  "WC-007": {
    slug: "golden-conch-waist-chain",
    tagline: "A conch shell, ridged in gold.",
    description:
      "The heaviest charm in the collection and the one people notice. Ridged along the spiral, hollow-cast so it stays light enough to forget about.",
    finish: "gold",
    motif: "nautical",
    collections: ["bridal", "occasion"],
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 3,
    images: [
      {
        id: "wc-007/front",
        alt: "Gold scallop-shell and conch waist chain draped down the front of dark denim jeans",
      },
      // { id: "wc-007/detail", alt: "Close detail of the ridged conch charm" },
    ],
  },

  /* ------------------------------------------------------------ bracelets
   *
   * Eight gold-finish bracelets, all free size, all ৳250.
   *
   * `images: []` ON PURPOSE, and not an oversight. These were the first
   * products added after migration 1009, so their photographs live in
   * `product_images` in the database where the ERP can reorder and replace
   * them. An id listed here as well would be a second source of truth for the
   * same picture, and the DB one wins anyway.
   *
   * `lengthInches: null` because they are free size — the PDP's "Length &
   * fit" panel is gated on it, so these pages simply do not tell a bracelet
   * customer to measure their hip.
   *
   * `motif: null` because the three motifs are waist-chain vocabulary
   * (moons, shells, plain chain) and none of them describes a flower cuff.
   */
  "BR-001": {
    slug: "golden-twin-drop-cuff-bracelet",
    tagline: "Two drops that pass without meeting.",
    description:
      "An open cuff that finishes in two tapered drops, one crossing above the other. Slips on sideways and settles wherever the wrist is narrowest.",
    finish: "gold",
    motif: null,
    collections: ["occasion", "everyday"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 50,
    images: [],
  },
  "BR-002": {
    slug: "golden-double-petal-cuff-bracelet",
    tagline: "Two petals, high polish.",
    description:
      "Two full, rounded petals meet at the front of an open cuff. The heaviest-looking piece here and among the lightest to wear — the forms are hollow.",
    finish: "gold",
    motif: null,
    collections: ["occasion"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 51,
    images: [],
  },
  "BR-003": {
    slug: "golden-hammered-wave-bracelet",
    tagline: "Beaten gold, caught mid-wave.",
    description:
      "Wide hammered panels that fold into one another the whole way round. The dimpled surface never sits still under light, which is the point of hammering it.",
    finish: "gold",
    motif: null,
    collections: ["occasion", "bridal"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 52,
    images: [],
  },
  "BR-004": {
    slug: "golden-flower-link-bracelet",
    tagline: "Flowers, linked head to head.",
    description:
      "Five-petal flowers joined one after another, each with a domed centre. The only piece in the set with a repeating motif rather than a single statement.",
    finish: "gold",
    motif: null,
    collections: ["occasion", "bridal"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 53,
    images: [],
  },
  "BR-005": {
    slug: "golden-twin-dome-cuff-bracelet",
    tagline: "Two domes, mirror finish.",
    description:
      "A smooth cuff that swells into two domes where the ends meet. Nothing engraved and nothing textured — it is the polish doing the work.",
    finish: "gold",
    motif: null,
    collections: ["occasion", "everyday"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 54,
    images: [],
  },
  "BR-006": {
    slug: "golden-crossover-bangle",
    tagline: "Two bands that cross and knot.",
    description:
      "A hinged bangle whose two bands wrap past each other and gather at the top. Opens on a clasp, so it goes on over the hand rather than being forced.",
    finish: "gold",
    motif: null,
    collections: ["everyday", "layered"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 55,
    images: [],
  },
  "BR-007": {
    slug: "golden-loop-and-drop-cuff-bracelet",
    tagline: "A loop, and a drop through it.",
    description:
      "One end curls into an open loop, the other tapers to a long drop that sits across the wrist. Sculptural from the side, almost plain from above.",
    finish: "gold",
    motif: null,
    collections: ["occasion", "everyday"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 56,
    images: [],
  },
  "BR-008": {
    slug: "golden-dome-link-bangle",
    tagline: "A heavy link, threaded on.",
    description:
      "A rounded tube bangle carrying one long domed link at the front, like a bead that outgrew its chain. The most solid-looking of the eight.",
    finish: "gold",
    motif: null,
    collections: ["occasion"],
    lengthInches: null,
    materials: GOLD_PLATE,
    featured: false,
    position: 57,
    images: [],
  },
};

/**
 * A product the ERP has but this file does not. Rather than hide it, fall back
 * to a neutral entry — a new SKU added in the ERP appears on the site
 * immediately, just without the story, which is a visible prompt to write one.
 */
export function fallbackMerchandising(
  sku: string,
  name: string,
  slug: string,
): Merchandising {
  const lower = name.toLowerCase();
  return {
    slug,
    tagline: "",
    description: "",
    finish: lower.includes("gold") ? "gold" : "silver",
    /* No motif guessed either. "oval" was the default here, which quietly
       filed every unmerchandised piece under "the plain chain, done properly"
       — including bracelets and rings, which are not chains at all. */
    motif: null,
    /* No mood guessed from a product name. An unmerchandised piece appears in
       the shop and on search, and simply does not surface in a mood tile
       until someone has decided which mood it belongs to. */
    collections: [],
    /*
     * NO LENGTH GUESSED. This was { min: 28, max: 34 } — waist-chain inches,
     * from when waist chains were the only thing the shop sold.
     *
     * The owner now adds products in the ERP, and anything without an entry
     * above lands here. A bracelet added that way would have shown a
     * "Length & fit" panel on its page telling the customer it measures 28 to
     * 34 inches and to put a tape measure round their hip. Null hides the
     * panel instead, which is right for a free-size piece and honest for a
     * piece nobody has measured.
     */
    lengthInches: null,
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 900,
    images: [{ id: `${sku.toLowerCase()}/front`, alt: name }],
  };
}

export const SKUS = Object.keys(MERCHANDISING);
