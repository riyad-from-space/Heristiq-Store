"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { subscribeAction } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Newsletter capture.
 *
 * Restyled for its own sand-coloured section rather than the footer it used
 * to live in: a white pill input beside a solid button, centred, stacking on
 * a phone. The status line sits below and reserves its height, so confirming
 * a subscription does not push the small print down the page.
 *
 * This used to validate an address and then throw it away, which is worse than
 * having no form: the customer believes they will hear about the restock, and
 * they would not have. It now writes to storefront_subscribers.
 *
 * An address already on the list reports plain success. "You are already
 * subscribed" tells anyone who asks who is on the list, and changes nothing
 * for the person asking.
 */
export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "queued" | "demo" | "failed">(
    "idle",
  );
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={cn("mx-auto w-full max-w-[440px]", className)}
      /*
       * noValidate, like the checkout's forms.
       *
       * `type="email"` makes the browser block submit on a malformed address
       * and show its own bubble — which meant the message below never
       * appeared, in the site's own voice and typography. One validator, ours.
       */
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
          setState("invalid");
          return;
        }
        startTransition(async () => {
          const result = await subscribeAction(email);
          if (!result.ok) {
            setState("failed");
            return;
          }
          setState(result.stored ? "queued" : "demo");
          setEmail("");
        });
      }}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setState("idle");
          }}
          aria-invalid={state === "invalid" || undefined}
          /* text-base: iOS Safari zooms the page for any focused input under
             16px, and this site is overwhelmingly phones. */
          className="border-control rounded-pill focus-visible:border-rose focus-visible:ring-rose-soft aria-invalid:border-danger min-h-12 flex-1 border-[1.5px] bg-white px-5 text-base text-ink placeholder:text-stone-soft focus-visible:ring-[3px] focus-visible:outline-none"
        />
        <Button type="submit" size="lg" disabled={pending} className="sm:w-auto">
          {pending && <Loader2 size={16} className="animate-spin" />}
          {pending ? "Adding you" : "Notify me"}
        </Button>
      </div>

      {/* min-h reserves the line so a confirmation does not shove the small
          print downward — a layout shift on the one element whose job is to
          say "that worked". */}
      <p aria-live="polite" className="text-copy-sm mt-4 min-h-6 font-semibold">
        {state === "invalid" && (
          <span className="text-danger">
            That does not look like an email address.
          </span>
        )}
        {state === "queued" && (
          <span className="text-rose-deep">
            You are on the list — watch your inbox for the next drop.
          </span>
        )}
        {state === "demo" && (
          <span className="text-stone">
            Demo mode: no database configured, so this was logged rather than
            saved.
          </span>
        )}
        {state === "failed" && (
          <span className="text-danger">
            That did not save. Please try again in a moment.
          </span>
        )}
      </p>
    </form>
  );
}
