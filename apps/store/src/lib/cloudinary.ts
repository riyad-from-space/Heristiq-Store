
import { LOCAL_IMAGES } from "@/lib/local-images.generated";

/*
 * Product images: local first, Cloudinary second, a designed placeholder last.
 *
 * Deliberately NOT next/image. Two reasons:
 *
 *  1. Cloudinary already is the image optimiser. Putting Next's optimiser in
 *     front of it means two resizes, two caches and two bills for one picture.
 *  2. The deploy target is Cloudflare Workers. Next's optimiser needs a runtime
 *     binding there; a plain <img> with a Cloudinary srcset needs nothing and
 *     is served from Cloudinary's CDN edge.
 *
 * So we emit the srcset ourselves and let the browser pick. f_auto gives AVIF
 * to browsers that take it and WebP to the rest; q_auto picks quality per image.
 */

/*
 * Read by literal name, not through lib/env: this module is imported by client
 * components (the PDP gallery), and lib/env is `server-only`. Both vars are
 * NEXT_PUBLIC_ and inlined at build time — a literal read is the only form the
 * bundler substitutes.
 */
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || undefined;
const FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || "heristiq";

/** The widths we actually ship. Phone-first, so the small end is dense. */
const WIDTHS = [320, 480, 640, 828, 1080, 1440, 1920] as const;

export type ImageCrop = "square" | "portrait" | "wide" | "natural";

/*
 * ------------------------------------------------------------- local images
 *
 * Cloudinary is now OPTIONAL. A photograph dropped into public/products/ is
 * resized at build time (scripts/image-manifest.mjs) and served straight from
 * the deployment — which on Cloudflare Workers means from Cloudflare's edge,
 * so it is already on a CDN.
 *
 * The order of preference is local, then Cloudinary, then the placeholder.
 * Local wins because it is the copy someone deliberately put in this repo, and
 * because it keeps working if the Cloudinary account lapses.
 *
 * The one thing local images cannot do is crop to an aspect ratio with subject
 * detection, which is what Cloudinary's g_auto gives. The image well already
 * enforces the ratio with object-cover, so the difference is that a badly
 * framed photograph crops badly rather than intelligently. Frame the photos
 * squarely and it does not matter.
 */
function localSrcSet(id: string, maxWidth: number) {
  const widths = LOCAL_IMAGES[id];
  if (!widths) return null;

  const base = `/products/${id.replace(/\//g, "--")}`;

  /* No variants generated (no sips on the build machine): serve the original
     at every size and let the browser scale it. */
  if (widths.length === 0) {
    return { src: base, srcSet: undefined as string | undefined };
  }

  const usable = widths.filter((w) => w <= maxWidth);
  const list = usable.length > 0 ? usable : [widths[0]];

  return {
    src: `${base.replace("/products/", "/products/_r/")}-${list[list.length - 1]}.jpg`,
    srcSet: list
      .map((w) => `${base.replace("/products/", "/products/_r/")}-${w}.jpg ${w}w`)
      .join(", "),
  };
}

/** True when this id has a photograph in the repo. */
export function hasLocalImage(id: string) {
  return Object.prototype.hasOwnProperty.call(LOCAL_IMAGES, id);
}

const ASPECT: Record<Exclude<ImageCrop, "natural">, string> = {
  square: "1:1",
  portrait: "4:5",
  wide: "16:9",
};

export type CloudinaryOptions = {
  crop?: ImageCrop;
  /** Cap the largest variant — no point shipping 1920 for a 96px thumbnail. */
  maxWidth?: number;
};

function transform(width: number, crop: ImageCrop) {
  const parts = ["f_auto", "q_auto", `w_${width}`];
  if (crop !== "natural") {
    // g_auto lets Cloudinary keep the subject in frame when it crops, which
    // matters because product shots are not all framed the same.
    parts.push(`ar_${ASPECT[crop]}`, "c_fill", "g_auto");
  } else {
    parts.push("c_limit");
  }
  return parts.join(",");
}

/**
 * A public ID is stored on the product row as e.g. "wc-005/front". The folder
 * prefix is config so the same catalogue can point at a staging folder.
 */
function publicId(id: string) {
  const folder = FOLDER;
  return id.startsWith(`${folder}/`) ? id : `${folder}/${id}`;
}

export function cloudinaryUrl(
  id: string,
  width: number,
  crop: ImageCrop = "portrait",
) {
  /* The PDP's zoom dialog asks for one large file; a local original is the
     largest there is. */
  const local = localSrcSet(id, width);
  if (local) return local.src;

  const cloud = CLOUD_NAME;
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/${transform(width, crop)}/${publicId(id)}`;
}

/**
 * The srcset for an image, from wherever it actually lives.
 *
 * Named for Cloudinary for the same reason the file is: every caller already
 * imports it, and renaming it would touch six components to say the same
 * thing. What changed is that it now answers from public/products/ first.
 */
export function cloudinarySrcSet(
  id: string,
  { crop = "portrait", maxWidth = 1920 }: CloudinaryOptions = {},
) {
  const local = localSrcSet(id, maxWidth);
  if (local) return local;

  const cloud = CLOUD_NAME;
  if (!cloud) return null;

  const widths = WIDTHS.filter((w) => w <= maxWidth);
  if (widths.length === 0) widths.push(WIDTHS[0]);

  return {
    src: cloudinaryUrl(id, widths[widths.length - 1], crop)!,
    srcSet: widths
      .map((w) => `${cloudinaryUrl(id, w, crop)} ${w}w`)
      .join(", "),
  };
}

/**
 * The social card. Cloudinary composes it from the product shot so there is no
 * separate OG asset to keep in sync — 1200x630, subject kept in frame.
 */
export function ogImageUrl(id: string) {
  /*
   * A social card has to be an absolute URL — Facebook and WhatsApp fetch it
   * from their own servers, so a relative path resolves against nothing. For a
   * local image that means the site's own origin.
   */
  const local = localSrcSet(id, 1200);
  if (local) {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://heristiq.com").replace(/\/$/, "");
    return `${base}${local.src}`;
  }

  const cloud = CLOUD_NAME;
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_jpg,q_auto,w_1200,h_630,c_fill,g_auto/${publicId(id)}`;
}

/*
 * ---------------------------------------------------------------- placeholders
 *
 * Retail prices and photography are both still to come, so the site has to look
 * finished without either. An unset image renders a designed tile — bone ground,
 * a gold monogram, the SKU — rather than a broken-image icon. It reads as
 * "photograph pending", which is true, instead of as a bug.
 */
const PLACEHOLDER_RATIO: Record<ImageCrop, number> = {
  square: 1,
  portrait: 1.25,
  wide: 0.5625,
  natural: 1.25,
};

export function placeholderDataUri(
  crop: ImageCrop = "portrait",
  label?: string,
) {
  const w = 800;
  const h = Math.round(w * PLACEHOLDER_RATIO[crop]);

  /*
   * The monogram is always the brand H. An earlier version took the first
   * letter of the Cloudinary path, which produced a "W" on every waist chain
   * and an "S" on every social tile — a letter that means nothing to a
   * customer. The optional label underneath is the SKU, which does.
   */
  /*
   * Paper, not shell — with a hairline frame.
   *
   * The fill used to be #f2ece1, which IS --color-shell, so on the two
   * sections with a shell background (the motif story and the image wells
   * themselves) the tile was invisible and the page read as a large empty
   * void rather than a photograph that has not been uploaded. Paper with a
   * line-strong border reads as a deliberate empty frame on every background
   * the site has.
   */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#fffdfa"/>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" fill="none" stroke="#e5ddd0" stroke-width="1.5"/>
<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.16}" fill="none" stroke="#d3c8b6" stroke-width="1.5"/>
<text x="${w / 2}" y="${h / 2}" fill="#a4854c" font-family="Georgia,serif" font-size="${w * 0.12}" text-anchor="middle" dominant-baseline="central">H</text>${
    label
      ? `
<text x="${w / 2}" y="${h / 2 + w * 0.23}" fill="#a29a8e" font-family="Helvetica,Arial,sans-serif" font-size="${w * 0.026}" letter-spacing="${w * 0.008}" text-anchor="middle">${escapeXml(label.toUpperCase())}</text>`
      : ""
  }
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
