"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The header search.
 *
 * A real field, not an icon that navigates: it submits to /shop?q=…, which
 * the shop page reads and filters on. Two reasons it pushes a URL rather than
 * filtering in place:
 *
 *   - a search result becomes linkable and shareable, which matters for a
 *     shop whose traffic arrives as pasted links from Instagram and WhatsApp;
 *   - the shop page already owns filtering by finish, motif and sort, so the
 *     query joins that instead of competing with it. A second, separate
 *     filter mechanism in the header would fight the filter bar.
 *
 * Hidden below lg, as the mockup does. The phone gets the same field inside
 * the menu panel, where there is room for it — a search box in a 390px header
 * next to a burger, a wordmark and a cart is a 60px input.
 */
export function SearchField({
  className,
  autoFocus = false,
  onSubmitted,
}: {
  className?: string;
  autoFocus?: boolean;
  /** Lets the mobile menu close itself once a search is fired. */
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  /*
   * useId, not a literal.
   *
   * This component renders TWICE on every page — once in the desktop header
   * and once inside the mobile menu panel — so a hard-coded id produced two
   * elements sharing it and two labels pointing at the same one. Invalid
   * HTML, and worse than cosmetic: a label resolves to the FIRST matching id,
   * so tapping the mobile menu's label focused the hidden desktop input.
   */
  const id = useId();

  return (
    <form
      role="search"
      /*
       * noValidate and a real submit handler, not a GET form pointed at
       * /shop. A native GET would serialise every field in the form and lose
       * the shop's existing finish/motif/sort params; router.push keeps this
       * one query in our control.
       */
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        /* An empty search means "show me everything", which is /shop with no
           query — not a page that says nothing matched. */
        router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
        onSubmitted?.();
      }}
      className={cn(
        "border-line rounded-pill focus-within:border-rose focus-within:ring-rose-soft flex items-center gap-2 bg-white px-3.5 transition-[border-color,box-shadow] focus-within:ring-[3px]",
        className,
      )}
    >
      <Search size={16} className="text-stone shrink-0" aria-hidden />
      <label htmlFor={id} className="sr-only">
        Search the shop
      </label>
      <input
        id={id}
        type="search"
        name="q"
        autoFocus={autoFocus}
        placeholder="Search waist chains, styles…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        /* text-base so iOS Safari does not zoom the page on focus. The visual
           size drops to 0.9rem from sm: up, where no phone is looking. */
        className="text-ink placeholder:text-stone min-h-11 w-full bg-transparent text-base focus:outline-none sm:text-[0.9rem]"
      />
    </form>
  );
}
