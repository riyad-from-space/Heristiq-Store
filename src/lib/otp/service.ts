import "server-only";
import { authEnv, otpEnv } from "@/lib/env";
import { hmacHex, numericCode, safeEqual } from "@/lib/crypto";
import { normalisePhone } from "@/lib/phone";
import { otpSender, type OtpChannel } from "@/lib/otp/sender";
import { otpStore } from "@/lib/otp/store";
import { markPhoneVerified } from "@/lib/otp/session";

/*
 * Phone verification for COD orders.
 *
 * This is the storefront's single most valuable control, and it is not really
 * about codes. Return-to-origin — a courier carries a ৳300 parcel across the
 * country to a number that never picks up — is the biggest cost in Bangladeshi
 * f-commerce, and most of it is orders placed with a phone number the person
 * placing them cannot answer. Making the number answer once, before the parcel
 * moves, removes most of that.
 *
 * Three limits, each closing a different hole:
 *   attempts per code   — stops guessing a 6-digit code (5 tries of a million)
 *   sends per hour      — stops using this site as a free SMS bomber
 *   resend cooldown     — stops the same, faster, and stops double-taps costing
 *                         two SMS
 *
 * The stored value is HMAC-SHA256(code, server secret), never the code. A bare
 * sha256 of six digits is a rainbow table anyone can build in a second.
 */

export type OtpRequestResult =
  | {
      ok: true;
      channel: OtpChannel;
      /** Dev only: the code, so checkout is testable with no SMS gateway. */
      devCode?: string;
      expiresInSeconds: number;
    }
  | { ok: false; error: string; retryAfterSeconds?: number };

export type OtpVerifyResult =
  | { ok: true; phone: string }
  | { ok: false; error: string; attemptsLeft?: number };

async function hash(code: string, phone: string) {
  /* The phone is in the message, not just the code, so a hash lifted from one
     row cannot be replayed against another number. */
  return hmacHex(authEnv.secret, `${phone}:${code}`);
}

export async function requestOtp(rawPhone: string): Promise<OtpRequestResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: "That does not look like a Bangladeshi mobile number." };
  }

  const store = otpStore();
  const history = await store.recentFor(
    phone,
    new Date(Date.now() - 60 * 60 * 1000),
  );

  if (history.length >= otpEnv.maxPerHour) {
    return {
      ok: false,
      error:
        "Too many codes requested for this number. Try again in an hour, or message us on WhatsApp and we will take the order directly.",
    };
  }

  const newest = history[0];
  if (newest) {
    const since = (Date.now() - new Date(newest.createdAt).getTime()) / 1000;
    if (since < otpEnv.resendCooldownSeconds) {
      return {
        ok: false,
        error: "A code was just sent. Give it a moment before asking for another.",
        retryAfterSeconds: Math.ceil(otpEnv.resendCooldownSeconds - since),
      };
    }
  }

  const code = numericCode(6);
  const sender = otpSender();

  await store.create({
    phone,
    codeHash: await hash(code, phone),
    channel: sender.channel,
    expiresAt: new Date(Date.now() + otpEnv.ttlSeconds * 1000),
  });

  /*
   * Stored before sent, on purpose. A code that was texted but not stored can
   * never be verified, and the customer has no way to know why. A code stored
   * but not texted is a resend away from working.
   */
  try {
    await sender.send(phone, code);
  } catch (error) {
    console.error("[otp] send failed", error);
    return {
      ok: false,
      error:
        "We could not send the code just now. Try again, or order over WhatsApp instead.",
    };
  }

  return {
    ok: true,
    channel: sender.channel,
    /*
     * NODE_ENV, not just the flag. OTP_DEBUG defaults to on outside
     * production, and returning a verification code to the browser in
     * production would hand every account to whoever asked for it.
     */
    ...(otpEnv.debug &&
      process.env.NODE_ENV !== "production" && { devCode: code }),
    expiresInSeconds: otpEnv.ttlSeconds,
  };
}

export async function verifyOtp(
  rawPhone: string,
  rawCode: string,
): Promise<OtpVerifyResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, error: "Enter your mobile number again." };

  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) {
    return { ok: false, error: "The code is 6 digits." };
  }

  const store = otpStore();

  /* Newest unconsumed code for this number. Older ones stay on record as
     evidence of what was sent, but only the latest can be redeemed. */
  const record = await store.newestUnconsumed(phone);

  if (!record) {
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Ask for a new one." };
  }

  if (record.attempts >= otpEnv.maxAttempts) {
    return {
      ok: false,
      error: "Too many wrong tries. Ask for a new code.",
      attemptsLeft: 0,
    };
  }

  const matches = safeEqual(record.codeHash, await hash(code, phone));

  if (!matches) {
    /* Count the failure before returning it, or the attempt limit is
       decorative. */
    await store.bumpAttempts(record.id, record.attempts + 1);

    const attemptsLeft = Math.max(0, otpEnv.maxAttempts - (record.attempts + 1));
    return {
      ok: false,
      error:
        attemptsLeft > 0
          ? `That code is not right. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`
          : "That code is not right, and that was the last try. Ask for a new code.",
      attemptsLeft,
    };
  }

  /* Burn it. A verified code must not be reusable, by this browser or another. */
  await store.consume(record.id);

  await markPhoneVerified(phone);
  return { ok: true, phone };
}
