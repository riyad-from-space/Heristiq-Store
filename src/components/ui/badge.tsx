import { cn } from "@/lib/utils";
import { availabilityLabel, type Availability } from "@/lib/erp/types";

const tones = {
  neutral: "bg-paper/90 text-ink border-line",
  gold: "bg-gold-wash text-gold-deep border-gold/30",
  warn: "bg-paper/90 text-warn border-warn/30",
  sea: "bg-sea text-bone border-transparent",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-eyebrow inline-flex items-center border px-2.5 py-1 font-medium uppercase backdrop-blur-sm",
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

  const tone = availability.state === "low_stock" ? "warn" : "sea";
  return (
    <Badge tone={tone} className={className}>
      {availabilityLabel(availability)}
    </Badge>
  );
}
