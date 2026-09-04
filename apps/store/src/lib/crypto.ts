import "server-only";

/*
 * HMAC, via Web Crypto.
 *
 * Web Crypto rather than node:crypto because this code runs on Cloudflare
 * Workers, where node:crypto is a compatibility shim rather than the real
 * thing. `globalThis.crypto.subtle` is native on Workers and on Node 20+, so
 * one implementation covers local dev, the build and production.
 */

const encoder = new TextEncoder();

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function hmacHex(secret: string, message: string) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison.
 *
 * A plain `===` on a signature leaks, through how long it takes to fail, how
 * many leading characters were right — which is enough to forge one byte at a
 * time. Both OTP hashes and cookie signatures are compared with this.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * A numeric code of `digits` length, from the CSPRNG.
 *
 * Rejection sampling rather than `% 1000000`: modulo on a 32-bit draw makes the
 * low codes marginally likelier, and while the bias is tiny it is free to
 * avoid, and "the random number generator is slightly wrong" is not a sentence
 * anyone wants to read about their own OTP.
 */
export function numericCode(digits = 6): string {
  const max = 10 ** digits;
  const limit = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  let draw = 0;
  do {
    crypto.getRandomValues(buffer);
    draw = buffer[0];
  } while (draw >= limit);
  return String(draw % max).padStart(digits, "0");
}
