"use client";

import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Form primitives for the checkout.
 *
 * Not shadcn's form stack: that comes with react-hook-form and a resolver, and
 * this is one screen with a dozen fields whose validation already lives on the
 * server in lib/orders/schema.ts. A second copy of the rules in the browser is
 * a second thing to keep in sync.
 *
 * What these do enforce is the part that is easy to get wrong by hand:
 *   - a real <label> tied to the control, every time
 *   - 48px controls, because this is a phone form
 *   - 16px text in inputs, because anything smaller makes iOS Safari zoom the
 *     page on focus and the customer then has to pinch back out
 *   - aria-invalid and aria-describedby wired to the error text
 */
/*
 * How a control learns about its own label's error.
 *
 * Via context rather than by cloning children, because a Field wraps anything
 * from one input to an input beside a button, and cloning would have to guess
 * which child is the control. Every control below reads this, so `aria-invalid`
 * and `aria-describedby` are wired by construction and cannot be forgotten at
 * the one call site that needed them.
 */
const FieldContext = createContext<{
  describedBy?: string;
  invalid: boolean;
} | null>(null);

function useFieldAria(props: { "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"] }) {
  const field = useContext(FieldContext);
  return {
    /* An explicit prop always wins — the component knows better than the
       wrapper if it says so. */
    "aria-describedby": props["aria-describedby"] ?? field?.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid ? true : undefined),
  };
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const describedBy =
    [
      error && htmlFor ? `${htmlFor}-error` : null,
      hint && !error && htmlFor ? `${htmlFor}-hint` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-3 text-sm font-medium"
      >
        {label}
        {optional && (
          <span className="text-ink-faint text-xs font-normal">Optional</span>
        )}
      </label>

      <FieldContext.Provider
        value={{ describedBy, invalid: Boolean(error) }}
      >
        <div className="mt-2">{children}</div>
      </FieldContext.Provider>

      {hint && !error && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-ink-faint mt-2 text-xs leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="text-danger mt-2 text-xs"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full min-h-12 border border-line-strong bg-paper px-3.5 text-base " +
  "placeholder:text-ink-faint focus:border-ink focus:outline-none " +
  "disabled:opacity-50 aria-invalid:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input className={cn(control, className)} {...useFieldAria(props)} {...props} />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(control, "min-h-24 py-3 leading-relaxed", className)}
      {...useFieldAria(props)}
      {...props}
    />
  );
}

/*
 * A native <select>, not a Radix listbox.
 *
 * Sixty-four districts is exactly the case where the platform wins: iOS and
 * Android both render a native picker with type-ahead, momentum scrolling and
 * no chance of the list being clipped by a scroll container. A custom listbox
 * would look more like the rest of the design and be worse to use.
 */
export function Select({ className, ...props }: ComponentProps<"select">) {
  const aria = useFieldAria(props);
  return (
    <select
      className={cn(
        control,
        "appearance-none bg-[position:right_0.875rem_center] bg-no-repeat pr-10",
        className,
      )}
      style={{
        /* An inline chevron, so no icon font or extra element is needed. */
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236a635a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...aria}
      {...props}
    />
  );
}

/** A radio row that is a whole tappable card, not a 16px dot. */
export function RadioCard({
  checked,
  label,
  description,
  onSelect,
  name,
  value,
  icon,
}: {
  checked: boolean;
  label: string;
  description?: string;
  onSelect: () => void;
  name: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 border px-4 py-3 transition-colors",
        checked
          ? "border-ink bg-paper"
          : "border-line hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="accent-ink size-4 shrink-0"
      />
      {icon}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="text-ink-muted mt-0.5 block text-xs leading-relaxed">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
