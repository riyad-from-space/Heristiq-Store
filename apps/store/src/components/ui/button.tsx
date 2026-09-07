import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * Five variants, in two groups. The comment used to say "three roles, and no
 * more" while the object below defined five — `gold` and `onDark` were added
 * for the hero and never written down. Reconciled rather than removed: both
 * are load-bearing, and an accurate list is worth more than a tidy claim.
 *
 * On light ground:
 *   primary   — the one action on the screen (add to cart, place order)
 *   secondary — an outlined alternative next to it
 *   quiet     — text with a rule under it; for "see all" and inline links
 *
 * On the sea/hero ground, where the three above have no contrast:
 *   gold      — the primary action over a photograph
 *   onDark    — the outlined alternative beside it
 *
 * min-h-11 (44px) everywhere. Apple's touch minimum, and this is a phone site.
 *
 * The press: a 2% squash on pointer-down, which is the whole of the button's
 * motion. It is behind `motion-safe:` rather than relying on the global
 * reduced-motion rule, because that rule only shortens the duration — the
 * scale would still happen, just instantly. Someone who asked for no motion
 * should get none.
 */
const base =
  "inline-flex items-center justify-center gap-2 font-medium " +
  "transition-[color,background-color,border-color,text-decoration-color,scale,opacity] " +
  "duration-quick ease-out-soft motion-safe:active:scale-[0.98] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold " +
  "disabled:pointer-events-none disabled:opacity-40";

const variants = {
  primary: "bg-ink text-bone hover:bg-sea rounded-sm",
  secondary:
    "border border-line-strong bg-transparent text-ink hover:border-ink hover:bg-shell rounded-sm",
  gold: "bg-gold text-white hover:bg-gold-deep rounded-sm",
  quiet:
    "text-ink underline decoration-line-strong decoration-1 underline-offset-4 hover:decoration-gold px-0",
  onDark:
    "border border-white/25 bg-transparent text-white hover:bg-white hover:text-sea rounded-sm",
} as const;

const sizes = {
  sm: "min-h-9 px-4 text-xs tracking-wide",
  md: "min-h-11 px-6 text-sm tracking-wide",
  lg: "min-h-13 px-8 text-sm tracking-wide",
} as const;

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** Render as the child element instead of a <button> — for <Link>. */
  asChild?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(
        base,
        variants[variant],
        variant === "quiet" ? "min-h-0" : sizes[size],
        className,
      )}
      {...props}
    />
  );
}
