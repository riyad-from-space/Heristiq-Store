import { ChainMotif } from "@/components/ui/chain-motif";
import type { ImageCrop } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

/*
 * The tile shown where a photograph will go.
 *
 * The approved mockup draws these as rose-tinted gradient blocks with the
 * chain motif over them, and it is explicit that they are placeholders for
 * real product photography — not a design element. So this is the EMPTY STATE
 * only: ProductImage renders a real <img> with a srcset the moment a
 * photograph exists for an id, and falls back here when one does not.
 *
 * That matters right now because there are no photographs in the repo yet, so
 * this is currently every image on the site. It has to look deliberate rather
 * than broken.
 *
 * ---------------------------------------------------------------------------
 * Why the gradient is picked from the id
 *
 * The mockup assigns its five gradients by hand (ph--a through ph--e). Here
 * they are chosen by hashing the image id, which buys two things a random or
 * round-robin pick would not:
 *
 *   - the same piece gets the same gradient on the home page, the shop grid
 *     and its own product page, so it reads as that piece's placeholder
 *     rather than as noise;
 *   - it is stable across server and client renders. Math.random() here would
 *     produce a different gradient on the server than on the client and React
 *     would report a hydration mismatch on every card.
 */

/** Height as a multiple of width, matching ProductImage's aspect wells. */
const RATIO: Record<ImageCrop, number> = {
  square: 1,
  portrait: 1.25,
  wide: 0.5625,
  natural: 1.25,
};

/*
 * The five gradients, transcribed from the mockup's .ph--a … .ph--e.
 *
 * Left as literal hex rather than tokens on purpose: these are stand-ins for
 * photographs, not part of the palette. Turning them into design tokens would
 * imply they are a brand surface something else might reuse, and they should
 * disappear entirely once the shoot lands.
 */
const GRADIENTS = [
  "linear-gradient(150deg, #eecdd3 0%, #d99fac 55%, #b5788d 100%)",
  "linear-gradient(150deg, #f3e7dd 0%, #e6c9c0 60%, #cf9fa6 100%)",
  "linear-gradient(150deg, #e7d6dd 0%, #caa7b6 55%, #7d5768 100%)",
  "linear-gradient(150deg, #f6ece4 0%, #ecd6cf 55%, #d7a9b0 100%)",
  "linear-gradient(150deg, #d9b7c1 0%, #b98a9c 55%, #6f4f5e 100%)",
];

/** A small stable hash, so an id always maps to the same gradient. */
function pick(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export function PlaceholderTile({
  id = "",
  crop = "portrait",
  /** The accessible name — the product, same as a real photograph's alt. */
  alt,
  className,
}: {
  /** The image id this stands in for. Only used to pick a stable gradient. */
  id?: string;
  crop?: ImageCrop;
  alt?: string;
  className?: string;
}) {
  return (
    <div
      /*
       * A tile standing in for a named product is a labelled image; one with
       * no name is decoration. Announcing "image" with no name would just add
       * noise to a grid of nine.
       */
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ background: pick(id) }}
    >
      {/* A soft highlight, so the block reads as a lit surface rather than a
          flat swatch. Matches the mockup's .ph::after. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 25% 15%, rgba(255,255,255,.5), transparent 55%)",
        }}
      />
      {/* currentColor, set here to blush, is what the motif inherits. */}
      <ChainMotif className="text-blush absolute inset-0 h-full w-full opacity-50" />
      {/* Reserves the height when this is not inside an aspect-ratio well. */}
      <div style={{ paddingTop: `${RATIO[crop] * 100}%` }} />
    </div>
  );
}
