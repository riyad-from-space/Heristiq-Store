"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { sendMessageAction } from "@/app/contact/actions";
import { Field, Input, Textarea } from "@/components/checkout/fields";
import { Button } from "@/components/ui/button";

/*
 * The contact form.
 *
 * Reuses the checkout's field primitives rather than growing a second set —
 * same 48px controls, same 16px text so iOS does not zoom on focus, same
 * aria-invalid wiring. A contact form that looks like a different website is
 * the classic tell of a bolted-on page.
 *
 * Either an email or a phone is required, not both: plenty of customers here
 * have only one they check.
 */
export function ContactForm({ orderReference = "" }: { orderReference?: string }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    orderReference,
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ stored: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const patch = (next: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const rest = { ...current };
      for (const key of Object.keys(next)) delete rest[key];
      return rest;
    });
  };

  if (sent) {
    return (
      <div className="border-success/30 bg-success/5 border px-5 py-8 text-center">
        <CheckCircle2 size={24} className="text-success mx-auto" />
        <p className="font-display mt-4 text-display-s">Message sent</p>
        <p className="text-ink-muted mx-auto mt-2 max-w-sm text-copy-sm">
          {sent.stored
            ? "We reply within a day, usually much sooner. If it is urgent, WhatsApp is faster."
            : "Demo mode — no database is configured, so this message was written to the server log rather than saved."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setFormError(null);
        startTransition(async () => {
          const result = await sendMessageAction({
            name: form.name,
            email: form.email,
            phone: form.phone,
            subject: form.subject || null,
            orderReference: form.orderReference || null,
            message: form.message,
          });
          if (result.ok) {
            setSent({ stored: result.stored });
            return;
          }
          setErrors(result.fieldErrors ?? {});
          setFormError(result.error);
        });
      }}
    >
      {formError && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/5 text-danger border px-4 py-3 text-sm"
        >
          {formError}
        </p>
      )}

      <Field label="Your name" htmlFor="c-name" error={errors.name}>
        <Input
          id="c-name"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          autoComplete="name"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Mobile number"
          htmlFor="c-phone"
          error={errors.phone}
          hint="Either this or an email."
        >
          <Input
            id="c-phone"
            value={form.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label="Email" htmlFor="c-email" error={errors.email} optional>
          <Input
            id="c-email"
            value={form.email}
            onChange={(e) => patch({ email: e.target.value })}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
      </div>

      <Field
        label="Order number"
        htmlFor="c-order"
        optional
        error={errors.orderReference}
        hint="If you are writing about an order — it looks like HQ-01042."
      >
        <Input
          id="c-order"
          value={form.orderReference}
          onChange={(e) => patch({ orderReference: e.target.value })}
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="HQ-01042"
        />
      </Field>

      <Field label="How can we help?" htmlFor="c-message" error={errors.message}>
        <Textarea
          id="c-message"
          value={form.message}
          onChange={(e) => patch({ message: e.target.value })}
          rows={5}
          maxLength={2000}
          placeholder="Which length should I take for a 30 inch waist?"
          required
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending
          </>
        ) : (
          <>
            <Send size={16} />
            Send message
          </>
        )}
      </Button>
    </form>
  );
}
