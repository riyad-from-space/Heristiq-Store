"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { subscribeAction } from "@/app/contact/actions";
import { cn } from "@/lib/utils";

/*
 * Newsletter capture.
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
      className={cn("flex flex-col gap-2", className)}
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
      <div className="flex items-center border-b border-white/25 focus-within:border-gold-wash">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setState("idle");
          }}
          /* text-base: iOS Safari zooms the page for any focused input under
             16px, and this site is overwhelmingly phones. */
          className="min-h-11 w-full bg-transparent text-base text-bone placeholder:text-bone/40 focus:outline-none sm:text-sm"
        />
        <button
          type="submit"
          aria-label="Subscribe"
          disabled={pending}
          className="grid size-11 shrink-0 place-items-center text-bone/70 transition hover:text-bone disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
      </div>

      <p aria-live="polite" className="min-h-5 text-xs">
        {state === "invalid" && (
          <span className="text-gold-wash">
            That does not look like an email address.
          </span>
        )}
        {state === "queued" && (
          <span className="text-bone/60">
            Thank you — we will email you when something new lands.
          </span>
        )}
        {state === "demo" && (
          <span className="text-bone/60">
            Demo mode: no database configured, so this was logged rather than
            saved.
          </span>
        )}
        {state === "failed" && (
          <span className="text-gold-wash">
            That did not save. Please try again in a moment.
          </span>
        )}
      </p>
    </form>
  );
}
