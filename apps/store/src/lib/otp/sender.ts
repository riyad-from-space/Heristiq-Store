import "server-only";
import { site } from "@/config/site";
import { smsEnv } from "@/lib/env";
import { whatsappNumber } from "@/lib/phone";

/*
 * How a code reaches a phone.
 *
 * An interface with two implementations, for the same reason payments and
 * couriers are interfaces: which SMS provider this business ends up on depends
 * on trade-licence paperwork that is not finished, and WhatsApp Cloud API needs
 * a verified business account it does not have yet. Neither should be able to
 * hold up the checkout, and neither should require a refactor to swap in.
 *
 * A third implementation — WhatsApp via the Cloud API — drops in here with no
 * change anywhere else: implement `send`, add it to `otpSender()`.
 */
export type OtpChannel = "sms" | "whatsapp" | "console";

export interface OtpSender {
  readonly channel: OtpChannel;
  /** Throws if the code could not be handed off. The caller reports that. */
  send(phone: string, code: string): Promise<void>;
}

function messageFor(code: string) {
  /* Short on purpose: one SMS segment is 160 GSM-7 characters, and a second
     segment doubles the cost of every order confirmation. */
  return `${code} is your ${site.name} verification code. It expires in 5 minutes.`;
}

/**
 * The development sender: writes the code to the server log.
 *
 * Not a stub that pretends to succeed — it genuinely delivers the code to the
 * only place a developer with no SMS account can read it.
 */
export class ConsoleOtpSender implements OtpSender {
  readonly channel = "console" as const;

  async send(phone: string, code: string) {
    console.info(
      `\n  ┌─ OTP ─────────────────────────────\n` +
        `  │  ${phone}   code: ${code}\n` +
        `  │  No SMS gateway configured (SMS_API_URL).\n` +
        `  └───────────────────────────────────\n`,
    );
  }
}

/**
 * A generic HTTP SMS gateway.
 *
 * `SMS_API_URL` is a template. Bangladeshi bulk-SMS providers all take one
 * call with an api key, a sender id, a number and a message, but no two agree
 * on the parameter names, so the names live in configuration rather than in
 * this file:
 *
 *   SMS_API_URL=https://bulksmsbd.net/api/smsapi?api_key={key}&type=text&number={phone}&senderid={sender}&message={message}
 *
 * Placeholders {key} {sender} {phone} {message} are substituted and
 * URL-encoded. With SMS_API_METHOD=POST the same placeholders are filled into
 * the URL's query string and sent as a JSON body instead, which covers the
 * providers that insist on it.
 */
export class HttpSmsSender implements OtpSender {
  readonly channel = "sms" as const;

  async send(phone: string, code: string) {
    const template = smsEnv.url;
    if (!template) throw new Error("SMS_API_URL is not configured");

    const values: Record<string, string> = {
      key: smsEnv.apiKey ?? "",
      sender: smsEnv.senderId ?? "",
      /* Gateways want the international form without a plus. */
      phone: whatsappNumber(phone) ?? phone,
      message: messageFor(code),
    };

    const fill = (raw: string, encode: boolean) =>
      raw.replace(/\{(key|sender|phone|message)\}/g, (_, name: string) =>
        encode ? encodeURIComponent(values[name]) : values[name],
      );

    const url = fill(template, true);

    /*
     * A gateway that hangs would hang the checkout with it. Five seconds is
     * longer than any of these APIs take and shorter than a customer's
     * patience.
     */
    const response = await fetch(url, {
      method: smsEnv.method,
      ...(smsEnv.method === "POST" && {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: values.key,
          senderid: values.sender,
          number: values.phone,
          message: values.message,
        }),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      /*
       * The body, not just the status: these gateways answer 200 with
       * "invalid api key" as often as they answer 4xx, and the body is the only
       * thing that says which. It goes to the server log, never to the
       * customer — it can contain the api key.
       */
      const body = await response.text().catch(() => "");
      throw new Error(
        `SMS gateway refused (${response.status}): ${body.slice(0, 200)}`,
      );
    }
  }
}

let cached: OtpSender | null = null;

export function otpSender(): OtpSender {
  if (cached) return cached;
  cached = smsEnv.configured ? new HttpSmsSender() : new ConsoleOtpSender();
  return cached;
}
