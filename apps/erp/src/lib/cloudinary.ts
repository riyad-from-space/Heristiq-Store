import "server-only";

import { signParams } from "@/lib/cloudinary-sign";

/*
 * Signing uploads so the browser can talk to Cloudinary directly.
 *
 * THE PHOTOGRAPH NEVER PASSES THROUGH THIS SERVER. The browser asks for a
 * signature, then POSTs the file straight to Cloudinary. That is not a
 * micro-optimisation: this app is deployed to a Cloudflare Worker on the free
 * plan, which bills CPU per request and caps the body it will buffer. Piping a
 * 4 MB photograph from an iPhone through a Worker to get it to a CDN that is
 * already closer to the user than we are would be paying for a detour.
 *
 * What crosses this boundary is a 40-character hex string.
 *
 * THE SECRET STAYS HERE. `server-only` makes importing this from a client
 * component a build error rather than a silent leak — CLOUDINARY_API_SECRET in
 * a browser bundle is a stranger's write access to the account.
 */

/** Where ERP-uploaded photographs live, under the account folder. */
const PRODUCTS_PREFIX = "products";

export type UploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  /** Absolute public ID, folder included — what Cloudinary is told to store. */
  publicId: string;
  /** The same ID with the folder stripped — what goes in the database. */
  storedId: string;
};

function env(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Photograph uploads need CLOUDINARY_CLOUD_NAME, ` +
        `CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.`,
    );
  }
  return value;
}

/** True when the account is configured — lets the UI explain itself instead of throwing. */
export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

/*
 * A stable, collision-proof id for one photograph.
 *
 * Deliberately NOT "<sku>/front". The old naming carried meaning in the path —
 * front, worn, detail — which forced the owner to decide what a photograph
 * *was* before uploading it, and silently overwrote when they picked the same
 * word twice. Order now lives in product_images.position, where it can be
 * changed by dragging rather than by renaming a file.
 *
 * A fresh id per upload also means REPLACING a photograph changes its URL, so
 * there is no CDN copy of the old one to go stale. The old script needed
 * `invalidate: true` to work around exactly that.
 */
function freshId(sku: string) {
  const safeSku = sku.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 40) || "product";
  const stamp = Date.now().toString(36);
  const random = crypto.randomUUID().slice(0, 8);
  return `${PRODUCTS_PREFIX}/${safeSku}/${stamp}${random}`;
}

/**
 * Everything the browser needs to upload one file, and nothing more.
 *
 * NOTE WHAT IS NOT SIGNED: no `quality`, no `width`, no eager transformation.
 * Cloudinary stores the bytes it is given. Every delivered size is derived
 * from that master later by the storefront's own `f_auto,q_auto,w_N` URL, so
 * the master must stay the best copy that exists — re-encoding on the way in
 * would be a permanent tax on every rendition of that photograph, forever.
 */
export async function createUploadTicket(sku: string): Promise<UploadTicket> {
  const cloudName = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");
  const apiSecret = env("CLOUDINARY_API_SECRET");
  const folder = process.env.CLOUDINARY_FOLDER || "heristiq";

  const storedId = freshId(sku);
  const publicId = `${folder}/${storedId}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const signed = { public_id: publicId, timestamp };

  return {
    cloudName,
    apiKey,
    timestamp,
    signature: await signParams(signed, apiSecret),
    publicId,
    storedId,
  };
}

/**
 * Remove a photograph from the account.
 *
 * Best-effort by design — see the caller. An orphaned file costs a little
 * storage; a row pointing at a deleted file costs a broken image on the shop.
 */
export async function destroyImage(storedId: string) {
  if (!cloudinaryConfigured()) return;

  const cloudName = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");
  const apiSecret = env("CLOUDINARY_API_SECRET");
  const folder = process.env.CLOUDINARY_FOLDER || "heristiq";

  const publicId = storedId.startsWith(`${folder}/`)
    ? storedId
    : `${folder}/${storedId}`;
  const timestamp = Math.floor(Date.now() / 1000);

  /* `invalidate` is signed along with the rest. Everything except file,
     cloud_name, resource_type and api_key goes into the signature — sending a
     parameter the signature does not cover is a 401 whose body says only
     "Invalid Signature", with no hint as to which one. */
  const signed = {
    public_id: publicId,
    timestamp,
    /* Drop the CDN's copies of every rendition too, not just the master. */
    invalidate: "true",
  };
  const signature = await signParams(signed, apiSecret);

  const body = new FormData();
  for (const [key, value] of Object.entries(signed)) body.set(key, String(value));
  body.set("api_key", apiKey);
  body.set("signature", signature);

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15_000),
  });
}
