import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * Four button roles, matching the approved mockup.
 *
 *   primary     — the one action on the screen. Solid rose-deep, white text.
 *   ghost       — the outlined alternative beside it, on a light ground.
 *   ghostLight  — the same role on the plum band, where `ghost`'s ink border
 *                 and ink text have no contrast. Keeps literal light values
 *                 because the surface it sits on is dark by brand, not by
 *                 theme.
 *   quiet       — text with a rule under it, for "see all" and inline links.
 *
 * The fill is `rose-deep` and NOT the brighter `rose`, and this is the single
 * easiest mistake to make with this palette: white on rose measures 3.46:1
 * and fails AA as a button background. Rose is for accents, links, icons,
 * badges and hover — never behind white text. Hover moves TO rose because at
 * that point the text has already been read.
 *
 * min-h-11 (44px) everywhere. Apple's touch minimum, and this is a phone site.
 *
 * The press is a 1px nudge downward rather than a scale, matching the mockup,
 * and it sits behind `motion-safe:` — the global reduced-motion rule only
 * shortens durations, so the translate would still fire, just instantly.
 * Someone who asked for no motion should get none.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold " +
  "border-[1.5px] border-transparent " +
  "transition-[color,background-color,border-color,text-decoration-color,translate] " +
  "duration-quick ease-out-soft motion-safe:active:translate-y-px " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-rose " +
  "disabled:pointer-events-none disabled:opacity-40";

const variants = {
  primary: "bg-rose-deep text-white hover:bg-rose",
  ghost: "border-ink text-ink bg-transparent hover:bg-ink hover:text-blush",
  ghostLight:
    "border-blush/50 text-blush bg-transparent hover:border-blush hover:bg-blush hover:text-plum",
  quiet:
    "text-rose-deep decoration-rose-soft hover:decoration-rose-deep rounded-none border-0 px-0 underline decoration-[1.5px] underline-offset-4",
} as const;

const sizes = {
  sm: "min-h-9 px-4 text-[0.85rem]",
  md: "min-h-11 px-6 text-[0.95rem]",
  lg: "min-h-12 px-[26px] text-[0.95rem]",
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
