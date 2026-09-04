import "server-only";
import { cookies } from "next/headers";
import { authEnv } from "@/lib/env";
import { hmacHex, safeEqual } from "@/lib/crypto";

/*
 * "This phone number was verified" — as a signed cookie.
 *
 * Why a cookie and not a database session: verification is a fact about the
 * browser that just answered an SMS, it is worthless twenty minutes later, and
 * a signed cookie needs no row, no cleanup and no read on the hot path of
 * placing an order.
 *
 * The signature is the whole control. Without it this is a client-editable
 * claim that a phone number was verified, which would defeat the point of
 * having an OTP at all — so it is HMAC-SHA256 over phone plus expiry, compared
 * in constant time, with the secret only ever on the server.
 *
 * Deliberately NOT httpOnly-exempt, readable by JS, or long-lived: the
 * checkout form learns the verification state from a server action's return
 * value, never by reading the cookie.
 */
const COOKIE = "hq_phone_verified";
const TTL_SECONDS = 30 * 60;

function payload(phone: string, expiresAt: number) {
  return `${phone}.${expiresAt}`;
}

export async function markPhoneVerified(phone: string) {
  const expiresAt = Date.now() + TTL_SECONDS * 1000;
  const signature = await hmacHex(authEnv.secret, payload(phone, expiresAt));

  (await cookies()).set(COOKIE, `${phone}.${expiresAt}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/**
 * The verified phone in this browser, or null.
 *
 * Returns the phone rather than a boolean so the caller can check it against
 * the number actually being ordered for. Verifying 01712345678 and then
 * submitting an order for a different number is the exact bypass this closes.
 */
export async function verifiedPhone(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const [phone, expiresRaw, signature] = raw.split(".");
  if (!phone || !expiresRaw || !signature) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const expected = await hmacHex(authEnv.secret, payload(phone, expiresAt));
  return safeEqual(expected, signature) ? phone : null;
}

export async function clearPhoneVerification() {
  (await cookies()).delete(COOKIE);
}
