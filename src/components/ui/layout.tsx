import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One page gutter, defined once. 20px on a phone is the smallest margin that
 * still reads as generous rather than cramped at 360px wide.
 */
export function Container({
  className,
  width = "default",
  ...props
}: ComponentProps<"div"> & { width?: "default" | "wide" | "prose" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        width === "default" && "max-w-6xl",
        width === "wide" && "max-w-[100rem]",
        width === "prose" && "max-w-2xl",
        className,
      )}
      {...props}
    />
  );
}

/** Vertical rhythm between page sections, on the 8px scale. */
export function Section({
  className,
  tone = "bone",
  ...props
}: ComponentProps<"section"> & { tone?: "bone" | "shell" | "sea" | "paper" }) {
  return (
    <section
      className={cn(
        "py-16 sm:py-24",
        tone === "shell" && "bg-shell",
        tone === "paper" && "bg-paper",
        tone === "sea" && "bg-sea text-bone",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The all-caps micro label with a gold rule, used above almost every section
 * heading. It is the one repeated brand mark on the site, so it lives here
 * rather than being re-typed with slightly different tracking each time.
 */
export function Eyebrow({
  children,
  rule = true,
  className,
  onDark = false,
}: {
  children: ReactNode;
  rule?: boolean;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span
        className={cn(
          "text-eyebrow font-medium uppercase",
          onDark ? "text-gold-wash/80" : "text-ink-muted",
        )}
      >
        {children}
      </span>
      {rule && <span className="gold-rule" aria-hidden />}
    </div>
  );
}

/** A section heading in the display serif. h2 by default. */
export function SectionHeading({
  as: As = "h2",
  size = "m",
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3";
  size?: "xl" | "l" | "m" | "s";
  className?: string;
  children: ReactNode;
}) {
  const scale = {
    xl: "text-display-xl",
    l: "text-display-l",
    m: "text-display-m",
    s: "text-display-s",
  }[size];

  return (
    <As className={cn("font-display font-normal", scale, className)}>
      {children}
    </As>
  );
}
