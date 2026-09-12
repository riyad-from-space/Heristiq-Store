/*
 * Cloudinary's upload signature. One pure function, deliberately alone in this
 * file.
 *
 * NO `server-only` here, and no secret either — the caller passes it in. That
 * is what lets scripts/cloudinary-sign-test.mjs import this exact function and
 * check it against Cloudinary's own implementation. The signing rules are the
 * one part of the upload path that cannot be verified by running it: a wrong
 * signature returns a 401 whose body says only "Invalid Signature", with no
 * hint as to which rule was broken. A test that checked a COPY of this code
 * would pass while production failed.
 *
 * lib/cloudinary.ts is the `server-only` module that reads the secret and
 * calls this.
 *
 * Transcribed from their SDK (cloudinary_npm, lib/utils api_string_to_sign +
 * encode_param) rather than from the prose docs, because the prose leaves out
 * two things:
 *
 *   - signature_version 2, which is the DEFAULT, escapes `&` as %26 inside
 *     each `name=value` pair before they are joined;
 *   - null, undefined and empty-string values are dropped, not signed as empty.
 *
 * Excluded from the signature, per their docs: file, cloud_name, resource_type,
 * api_key. Sort is by parameter name; hash is SHA-1, their default.
 *
 * WebCrypto rather than node:crypto because this runs on a Cloudflare Worker,
 * where the standard API is the one guaranteed to be present.
 */
export async function signParams(
  params: Record<string, string | number>,
  secret: string,
): Promise<string> {
  const canonical = Object.entries(params)
    .map(([key, value]) => [String(key), value] as const)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`.replace(/&/g, "%26"))
    .join("&");

  const bytes = new TextEncoder().encode(canonical + secret);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
