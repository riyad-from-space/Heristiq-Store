import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * Three button roles, and no more:
 *   primary   — the one action on the screen (add to cart, place order)
 *   secondary — an outlined alternative next to it
 *   quiet     — text with a rule under it; for "see all" and inline links
 *
 * min-h-11 (44px) everywhere. Apple's touch minimum, and this is a phone site.
 */
const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 " +
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
