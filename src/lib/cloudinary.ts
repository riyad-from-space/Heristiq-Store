
/*
 * Cloudinary URL building.
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
  const cloud = CLOUD_NAME;
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/${transform(width, crop)}/${publicId(id)}`;
}

export function cloudinarySrcSet(
  id: string,
  { crop = "portrait", maxWidth = 1920 }: CloudinaryOptions = {},
) {
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#f2ece1"/>
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
