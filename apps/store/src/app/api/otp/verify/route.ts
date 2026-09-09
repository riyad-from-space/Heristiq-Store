import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp/service";

/*
 * Verify a phone code.
 *
 * A Route Handler and not a Server Action, and the reason is specific:
 * verifyOtp writes the OTP session cookie, and mutating cookies inside a
 * Server Action makes Next refresh the current route. On /checkout — which is
 * force-dynamic — that refresh remounted <CheckoutForm> and discarded
 * everything the customer had typed: the verified flag, their name, their
 * address. The observable bug was that verifying succeeded, the code field
 * vanished, and the page then said "verify your mobile number to place the
 * order" with the button disabled. No order could be completed through the UI.
 *
 * A handler called with fetch sets the same cookie and does not touch the
 * router, so nothing remounts and the form survives.
 *
 * Security is unchanged. A Server Action is itself a public POST endpoint, so
 * this is the same exposure with a different shape: the code is checked
 * server-side by verifyOtp, which owns the attempt limit and the expiry, and
 * lib/orders/place.ts still re-reads the cookie and compares it against the
 * phone in the payload before writing an order. Nothing here is trusted
 * because the client said so.
 */
export async function POST(request: Request) {
  let phone: unknown;
  let code: unknown;

  try {
    const body = await request.json();
    phone = body?.phone;
    code = body?.code;
  } catch {
    return NextResponse.json(
      { ok: false, error: "That request was malformed." },
      { status: 400 },
    );
  }

  if (typeof phone !== "string" || typeof code !== "string") {
    return NextResponse.json(
      { ok: false, error: "That request was malformed." },
      { status: 400 },
    );
  }

  try {
    /* verifyOtp returns its own failure reasons — a wrong code, an expired
       one, too many attempts — and those are safe to pass back verbatim. */
    return NextResponse.json(await verifyOtp(phone, code));
  } catch (error) {
    console.error("[otp] verify failed", error);
    return NextResponse.json(
      { ok: false, error: "We could not check that code. Try again." },
      { status: 500 },
    );
  }
}
