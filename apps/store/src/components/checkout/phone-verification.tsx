"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { requestOtpAction, verifyOtpAction } from "@/app/checkout/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/checkout/fields";
import { displayPhone, isValidPhone } from "@/lib/phone";

/*
 * Phone verification.
 *
 * The single highest-value control on this site. Return-to-origin — a courier
 * carrying a ৳300 parcel to a number nobody answers — is the biggest cost in
 * Bangladeshi f-commerce, and most of it comes from orders placed with a phone
 * that cannot be reached. One SMS before the parcel moves removes most of it.
 *
 * Which means the UX has to be gentle, because it is friction on the only
 * screen that earns money:
 *   - the code field appears in place, no navigation, nothing else lost
 *   - a verified number locks with a visible "change" escape hatch
 *   - 6 digits, numeric keypad, autocomplete="one-time-code" so both iOS and
 *     Android offer to fill it from the SMS
 *   - the resend countdown is honest about how long is left
 */
export function PhoneVerification({
  name,
  phone,
  onName,
  onPhone,
  verified,
  onVerified,
  errors,
}: {
  name: string;
  phone: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  verified: boolean;
  onVerified: (value: boolean) => void;
  errors: Record<string, string>;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = () => {
    setMessage(null);
    setDevCode(null);
    startTransition(async () => {
      const result = await requestOtpAction(phone);
      if (result.ok) {
        setSent(true);
        setCooldown(60);
        setDevCode(result.devCode ?? null);
        setMessage(
          result.channel === "console"
            ? "No SMS gateway is configured — the code is in the server log."
            : `Code sent to ${displayPhone(phone)}.`,
        );
      } else {
        setCooldown(result.retryAfterSeconds ?? 0);
        setMessage(result.error);
      }
    });
  };

  const verify = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await verifyOtpAction(phone, code);
      if (result.ok) {
        onVerified(true);
        setSent(false);
        setCode("");
        setMessage(null);
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <section aria-labelledby="contact-heading">
      <h2 id="contact-heading" className="font-display text-display-s">
        Who is it for
      </h2>

      <div className="mt-5 space-y-4">
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => onName(event.target.value)}
            autoComplete="name"
            placeholder="Name on the parcel"
            required
          />
        </Field>

        <Field
          label="Mobile number"
          htmlFor="phone"
          error={errors.phone}
          hint={
            verified
              ? undefined
              : "We text a code to this number. The courier calls it before delivering."
          }
        >
          <div className="flex gap-2">
            <Input
              id="phone"
              name="phone"
              value={phone}
              onChange={(event) => {
                /* Changing the number invalidates the verification — the server
                   checks the cookie against the submitted number anyway, and
                   showing a stale green tick would be a lie. */
                onPhone(event.target.value);
                if (verified) onVerified(false);
                setSent(false);
              }}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
              readOnly={verified}
              className={verified ? "bg-shell text-ink-muted" : undefined}
              required
            />
            {verified ? (
              <button
                type="button"
                onClick={() => {
                  onVerified(false);
                  setSent(false);
                }}
                className="text-ink-muted shrink-0 px-3 text-xs underline underline-offset-4"
              >
                Change
              </button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={send}
                disabled={!isValidPhone(phone) || pending || cooldown > 0}
                className="shrink-0"
              >
                {pending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : cooldown > 0 ? (
                  `${cooldown}s`
                ) : sent ? (
                  "Resend"
                ) : (
                  "Send code"
                )}
              </Button>
            )}
          </div>
        </Field>

        {verified && (
          <p className="text-success flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} />
            {displayPhone(phone)} verified
          </p>
        )}

        {sent && !verified && (
          <div className="border-line bg-paper border p-4">
            <Field label="6-digit code" htmlFor="otp">
              <div className="flex gap-2">
                <Input
                  id="otp"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  type="text"
                  inputMode="numeric"
                  /* Both iOS and Android read this and offer the code straight
                     from the SMS notification. */
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  className="tnum tracking-[0.4em]"
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={verify}
                  disabled={code.length !== 6 || pending}
                  className="shrink-0"
                >
                  {pending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
            </Field>

            {devCode && (
              /* Development only — the action refuses to return a code in
                 production. See lib/otp/service.ts. */
              <p className="border-warn/40 text-warn mt-3 border border-dashed px-3 py-2 text-xs">
                Dev mode: your code is{" "}
                <strong className="tnum font-medium">{devCode}</strong>
              </p>
            )}
          </div>
        )}

        {message && (
          <p
            role="status"
            className={`text-sm ${sent && !verified ? "text-ink-muted" : "text-danger"}`}
          >
            {message}
          </p>
        )}

        {!verified && (
          <p className="text-ink-faint flex items-start gap-2 text-xs leading-relaxed">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Verifying keeps cash-on-delivery working for everyone. We do not use
            your number for marketing.
          </p>
        )}
      </div>
    </section>
  );
}
