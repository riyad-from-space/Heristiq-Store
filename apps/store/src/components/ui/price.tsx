import { taka } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Price, including the case that matters most right now: no price.
 *
 * Retail prices are not set yet. The rule across the whole site is that an
 * unpriced piece says "Price on request" and cannot be added to a cart —
 * never ৳0, and never a hidden price with a live buy button.
 */
export function Price({
  amount,
  compareAt,
  className,
  size = "md",
}: {
  amount: number | null;
  compareAt?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const scale = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl sm:text-2xl",
  }[size];

  if (amount === null) {
    return (
      <span
        className={cn("text-ink-muted italic", scale, className)}
        /* The em dash-free wording is intentional: this is read aloud by
           screen readers as a sentence, not as a price. */
      >
        Price on request
      </span>
    );
  }

  const marked = compareAt != null && compareAt > amount;

  return (
    <span className={cn("tnum inline-flex items-baseline gap-2", scale, className)}>
      <span className={cn(marked && "text-danger")}>{taka(amount)}</span>
      {marked && (
        <span className="text-ink-faint text-[0.8em] line-through">
          {taka(compareAt)}
        </span>
      )}
    </span>
  );
}
