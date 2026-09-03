"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Newsletter capture.
 *
 * Phase 1 has nowhere to store a subscriber, so this validates and then says so
 * honestly rather than showing a fake "you're subscribed". A form that silently
 * discards an address is worse than no form: the customer thinks they will hear
 * about the restock, and they will not. The real POST lands in phase 6 with the
 * storefront tables.
 */
export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "queued">("idle");

  return (
    <form
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        setState(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) ? "queued" : "invalid");
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
          className="grid size-11 shrink-0 place-items-center text-bone/70 transition hover:text-bone"
        >
          <ArrowRight size={18} />
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
            Thanks — sign-up goes live with the shop. Follow us on Instagram
            meanwhile.
          </span>
        )}
      </p>
    </form>
  );
}
