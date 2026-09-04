import { cn } from "@/lib/utils";
import {
  cloudinarySrcSet,
  placeholderDataUri,
  type ImageCrop,
} from "@/lib/cloudinary";
import type { ProductImage as ProductImageType } from "@/lib/erp/types";

/*
 * A product photograph.
 *
 * Plain <img> on purpose — see lib/cloudinary.ts for why Cloudinary rather than
 * next/image. What this component owns:
 *
 *  - the aspect ratio, so the grid never reflows as images arrive (CLS is most
 *    of a bad LCP score on a 3G phone);
 *  - a shell-coloured well behind every image, so a slow load looks like an
 *    empty frame rather than a hole;
 *  - the fallback tile when there is no Cloudinary account or no upload yet.
 *
 * `sizes` has no sensible default — a wrong one makes the browser download a
 * 1440px file for a 160px thumbnail — so it is required.
 */
const RATIO: Record<ImageCrop, string> = {
  square: "aspect-square",
  portrait: "aspect-4/5",
  wide: "aspect-video",
  natural: "",
};

export function ProductImage({
  image,
  alt,
  sizes,
  crop = "portrait",
  priority = false,
  maxWidth,
  placeholderLabel,
  className,
  imgClassName,
}: {
  image: ProductImageType | undefined;
  /** Overrides the image's own alt — for a gallery thumb, say. */
  alt?: string;
  sizes: string;
  crop?: ImageCrop;
  /** Set on the LCP image only. Everything else stays lazy. */
  priority?: boolean;
  maxWidth?: number;
  /** Drawn on the placeholder tile when there is no photograph. Use the SKU. */
  placeholderLabel?: string;
  className?: string;
  imgClassName?: string;
}) {
  const label = alt ?? image?.alt ?? "";
  const remote = image ? cloudinarySrcSet(image.id, { crop, maxWidth }) : null;
  const src = remote?.src ?? placeholderDataUri(crop, placeholderLabel);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-shell",
        RATIO[crop],
        className,
      )}
    >
      <img
        src={src}
        srcSet={remote?.srcSet}
        sizes={remote ? sizes : undefined}
        alt={label}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        // fetchPriority is what actually moves the LCP image up the queue;
        // loading="eager" alone still leaves it behind the CSS.
        fetchPriority={priority ? "high" : "auto"}
        className={cn(
          "h-full w-full object-cover",
          crop === "natural" && "h-auto",
          imgClassName,
        )}
      />
    </div>
  );
}
