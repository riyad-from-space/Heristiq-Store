"use server";

import { requestOtp, verifyOtp } from "@/lib/otp/service";
import { placeOrder } from "@/lib/orders/place";
import type { CheckoutInput } from "@/lib/orders/schema";
import type { OtpRequestResult, OtpVerifyResult } from "@/lib/otp/service";
import type { PlaceOrderResult } from "@/lib/orders/place";

/*
 * The checkout's three server actions.
 *
 * Thin on purpose: every rule lives in lib/, which is testable without a
 * request and reusable by phase 6's admin. What this file adds is the trust
 * boundary — and the thing to remember about it is that a server action is a
 * public POST endpoint. Anyone can call these with anything.
 *
 * So none of them trust their arguments:
 *   - requestOtp normalises the number and enforces its own rate limits
 *   - verifyOtp counts failed attempts and burns the code
 *   - placeOrder re-prices every line against the ERP and checks that the
 *     phone on the order is the phone that actually answered an SMS
 *
 * Errors come back as values rather than thrown, because every one of them is
 * something the customer can act on — a wrong code, a piece that just sold
 * out — and an unhandled throw on this screen loses a filled-in address.
 */

export async function requestOtpAction(phone: string): Promise<OtpRequestResult> {
  try {
    return await requestOtp(phone);
  } catch (error) {
    /* An unreachable database or a missing secret. The customer gets a way
       forward; the detail goes to the log, not to them. */
    console.error("[checkout] requestOtp failed", error);
    return {
      ok: false,
      error:
        "We could not send a code just now. Try again in a moment, or order over WhatsApp.",
    };
  }
}

export async function verifyOtpAction(
  phone: string,
  code: string,
): Promise<OtpVerifyResult> {
  try {
    return await verifyOtp(phone, code);
  } catch (error) {
    console.error("[checkout] verifyOtp failed", error);
    return { ok: false, error: "We could not check that code. Try again." };
  }
}

export async function placeOrderAction(
  input: CheckoutInput,
): Promise<PlaceOrderResult> {
  try {
    return await placeOrder(input);
  } catch (error) {
    /*
     * The order may or may not exist at this point — a write that timed out
     * after committing looks exactly like one that failed. So the message does
     * not say "your order was not placed"; it points at the one channel where
     * a human can check. Telling someone their order failed when it did not is
     * how you get two parcels sent to one address.
     */
    console.error("[checkout] placeOrder failed", error);
    return {
      ok: false,
      error:
        "Something went wrong placing the order. Please message us on WhatsApp before trying again, so we do not send it twice.",
    };
  }
}
