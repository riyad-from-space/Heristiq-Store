import type { ImageCrop } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

/*
 * The tile shown where a photograph will go.
 *
 * This replaces the SVG data URI that lib/cloudinary.ts used to hand to an
 * <img src>, and the reason is the theme.
 *
 * A data URI is an opaque blob to CSS. Its colours were baked in as literal
 * hex — #fffdfa paper, #e5ddd0 hairline, #a4854c monogram — chosen for a bone
 * page. There are no photographs in the repo yet, so EVERY product image on
 * the site is this tile: four on the home page, two motif tiles, six Instagram
 * squares, nine on the shop grid. In dark mode all of them would have been
 * bright white rectangles, and the shop would have looked like a lightbox of
 * missing images rather than a dark theme.
 *
 * Inline SVG fixes it completely, because inline SVG is part of the document
 * and therefore part of the cascade. `fill-paper` compiles to
 * `fill: var(--color-paper)`, so the tile follows whatever that token resolves
 * to in the active theme, with no second copy of the palette and nothing to
 * keep in sync.
 *
 * Nothing is lost by not being an <img>. The old data URI could not be lazy
 * loaded in any useful sense (it arrived inside the HTML that referenced it)
 * and had no srcset; the real-photograph path in ProductImage still uses a
 * plain <img> with both. This is only the empty state.
 */

/** Height as a multiple of width, matching ProductImage's aspect wells. */
const RATIO: Record<ImageCrop, number> = {
  square: 1,
  portrait: 1.25,
  wide: 0.5625,
  natural: 1.25,
};

export function PlaceholderTile({
  crop = "portrait",
  /** Drawn under the monogram. The SKU, so an unphotographed piece is identifiable. */
  label,
  /** The accessible name — the product, same as a real photograph's alt. */
  alt,
  className,
}: {
  crop?: ImageCrop;
  label?: string;
  alt?: string;
  className?: string;
}) {
  const w = 800;
  const h = Math.round(w * RATIO[crop]);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-full w-full", className)}
      /*
       * A tile with a product name is a labelled image; one without is
       * decoration. Announcing "image" with no name would just add noise to a
       * grid of nine.
       */
      {...(alt
        ? { role: "img", "aria-label": alt }
        : { "aria-hidden": true, focusable: false })}
    >
      <rect width={w} height={h} className="fill-paper" />

      {/* The frame. Inset by half the stroke width so it is not clipped. */}
      <rect
        x={0.75}
        y={0.75}
        width={w - 1.5}
        height={h - 1.5}
        strokeWidth={1.5}
        className="fill-none stroke-line"
      />

      <circle
        cx={w / 2}
        cy={h / 2}
        r={w * 0.16}
        strokeWidth={1.5}
        className="fill-none stroke-line-strong"
      />

      {/*
       * The monogram is always the brand H. An earlier version took the first
       * letter of the image path, which produced a "W" on every waist chain
       * and an "S" on every social tile — a letter that means nothing to a
       * customer.
       *
       * font-display so it is Fraunces rather than the browser's default
       * serif; the class works here because this is real DOM, which the data
       * URI never was.
       */}
      <text
        x={w / 2}
        y={h / 2}
        fontSize={w * 0.12}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-display fill-gold"
      >
        H
      </text>

      {label && (
        <text
          x={w / 2}
          y={h / 2 + w * 0.23}
          fontSize={w * 0.026}
          letterSpacing={w * 0.008}
          textAnchor="middle"
          className="fill-ink-faint"
        >
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
