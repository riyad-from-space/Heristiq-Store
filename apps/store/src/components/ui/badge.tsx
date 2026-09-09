import { cn } from "@/lib/utils";
import { availabilityLabel, type Availability } from "@/lib/erp/types";

/*
 * Solid pills, per the mockup, which has exactly two: ink for a statement of
 * fact ("Bestseller", "Restocked") and rose-deep for a call to act
 * ("Pre-order"). Those map cleanly onto what this site actually needs to say
 * about stock, so the tones are named for the job rather than the colour.
 *
 * White-on-ink and white-on-rose-deep are both above AA. The brighter `rose`
 * is deliberately not a fill here — it is 3.46:1 behind white text.
 */
const tones = {
  /* A fact about the piece. */
  fact: "bg-ink text-white",
  /* Something to act on: available to pre-order. */
  action: "bg-rose-deep text-white",
  /* A soft tint, for use on a light card rather than over a photograph. */
  soft: "bg-rose-soft text-rose-deep",
} as const;

export function Badge({
  children,
  tone = "fact",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-pill inline-flex items-center px-2.5 py-1 text-[0.7rem] font-bold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The stock badge. Returns null when a piece is simply in stock — a badge on
 * every card is noise, and "In stock" is the state a customer assumes.
 */
export function StockBadge({
  availability,
  className,
}: {
  availability: Availability;
  className?: string;
}) {
  if (availability.state === "in_stock") return null;

  /*
   * Low stock is a fact ("Only 2 left"); sold out is an invitation to
   * pre-order, which is an action. That is the whole distinction the mockup's
   * two badge colours encode, and it happens to be the right one here.
   */
  const tone = availability.state === "low_stock" ? "fact" : "action";
  return (
    <Badge tone={tone} className={className}>
      {availabilityLabel(availability)}
    </Badge>
  );
}
