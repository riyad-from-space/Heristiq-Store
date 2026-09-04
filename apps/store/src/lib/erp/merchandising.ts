import type { FinishKey, MotifKey } from "@/config/site";

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
  motif: MotifKey;
  lengthInches: { min: number; max: number };
  materials: string;
  featured: boolean;
  position: number;
  /** Cloudinary public IDs, first is the hero. Empty renders the placeholder. */
  images: { id: string; alt: string }[];
};

const CHAIN_MATERIAL =
  "Rhodium or gold-plated brass, nickel-free. Not gold — priced to wear, not to keep in a box.";

export const MERCHANDISING: Record<string, Merchandising> = {
  "WC-001": {
    slug: "oval-link-waist-chain-silver",
    tagline: "Alternating oval links, silver finish.",
    description:
      "Large and small ovals alternate the whole way round, so the chain catches light at two different rhythms as you move. The plainest piece we make, and the one that goes with everything.",
    finish: "silver",
    motif: "oval",
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 30,
    images: [
      { id: "wc-001/front", alt: "Silver oval-link waist chain laid flat" },
      { id: "wc-001/worn", alt: "Silver oval-link waist chain worn at the hip" },
    ],
  },
  "WC-002": {
    slug: "oval-link-waist-chain-gold",
    tagline: "Alternating oval links, gold finish.",
    description:
      "The same alternating ovals in a warm gold finish. Worn low over linen or denim, it reads as jewellery rather than as a belt.",
    finish: "gold",
    motif: "oval",
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 10,
    images: [
      { id: "wc-002/front", alt: "Gold oval-link waist chain laid flat" },
      { id: "wc-002/worn", alt: "Gold oval-link waist chain worn at the hip" },
    ],
  },
  "WC-003": {
    slug: "long-oval-waist-chain-silver",
    tagline: "Elongated links, silver finish.",
    description:
      "Longer links mean fewer of them, and a cleaner line. The most restrained chain in the collection — barely there until it isn't.",
    finish: "silver",
    motif: "oval",
    lengthInches: { min: 30, max: 36 },
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 40,
    images: [
      { id: "wc-003/front", alt: "Silver long-oval waist chain laid flat" },
    ],
  },
  "WC-004": {
    slug: "long-oval-waist-chain-gold",
    tagline: "Elongated links, gold finish.",
    description:
      "Long gold ovals with enough weight to sit still. Our easiest first piece, and the one most people come back for in silver.",
    finish: "gold",
    motif: "oval",
    lengthInches: { min: 30, max: 36 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 20,
    images: [
      { id: "wc-004/front", alt: "Gold long-oval waist chain laid flat" },
      { id: "wc-004/worn", alt: "Gold long-oval waist chain worn at the hip" },
    ],
  },
  "WC-005": {
    slug: "silver-moon-waist-chain",
    tagline: "A crescent, hung off silver.",
    description:
      "A single crescent moon drops from a fine silver chain and settles at the hip. The piece the rest of the collection is named after.",
    finish: "silver",
    motif: "celestial",
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 1,
    images: [
      { id: "wc-005/front", alt: "Silver moon waist chain laid flat" },
      { id: "wc-005/detail", alt: "Close detail of the crescent moon charm" },
      { id: "wc-005/worn", alt: "Silver moon waist chain worn at the hip" },
    ],
  },
  "WC-006": {
    slug: "golden-starfish-waist-chain",
    tagline: "A starfish, cast in gold.",
    description:
      "Five arms, textured across the top, smooth underneath so it lies flat against skin. Somewhere between the sea and the sky, which is the whole idea.",
    finish: "gold",
    motif: "nautical",
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: true,
    position: 2,
    images: [
      { id: "wc-006/front", alt: "Golden starfish waist chain laid flat" },
      { id: "wc-006/detail", alt: "Close detail of the textured starfish charm" },
    ],
  },
  "WC-007": {
    slug: "golden-conch-waist-chain",
    tagline: "A conch shell, ridged in gold.",
    description:
      "The heaviest charm in the collection and the one people notice. Ridged along the spiral, hollow-cast so it stays light enough to forget about.",
    finish: "gold",
    motif: "nautical",
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 3,
    images: [
      { id: "wc-007/front", alt: "Golden conch shell waist chain laid flat" },
      { id: "wc-007/detail", alt: "Close detail of the ridged conch charm" },
    ],
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
    motif: "oval",
    lengthInches: { min: 28, max: 34 },
    materials: CHAIN_MATERIAL,
    featured: false,
    position: 900,
    images: [{ id: `${sku.toLowerCase()}/front`, alt: name }],
  };
}

export const SKUS = Object.keys(MERCHANDISING);
