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

/**
 * Vertical rhythm between page sections.
 *
 * `py-section` is the --spacing-section token, so the gap is defined once for
 * the whole site. Three home sections used to hand-roll `py-16 sm:py-24`
 * instead of coming through here; they now all use this.
 *
 * `as` exists because only one of these per page should be a landmark. A page
 * of six <section> elements gives a screen-reader user six unlabelled regions
 * to walk past, so a purely visual band passes `as="div"`.
 */
export function Section({
  className,
  tone = "bone",
  spacing = "default",
  as: As = "section",
  ...props
}: /* `ref` is omitted because the two tags disagree about it —
      Ref<HTMLElement> from the union is not assignable to Ref<HTMLDivElement>
      — and nothing here needs a ref. Everything else is identical between
      <section> and <div>. */
Omit<ComponentProps<"section">, "ref"> & {
  tone?: "bone" | "shell" | "inverted" | "paper";
  spacing?: "default" | "tight" | "none";
  as?: "section" | "div";
}) {
  return (
    <As
      className={cn(
        spacing === "default" && "py-section",
        spacing === "tight" && "py-section-tight",
        tone === "shell" && "bg-shell",
        tone === "paper" && "bg-paper",
        tone === "inverted" && "bg-inverted text-on-inverted",
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
          onDark ? "text-gold-pale/80" : "text-ink-muted",
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

/**
 * Eyebrow + heading + optional lede, as one block.
 *
 * This trio opens almost every section and page on the site, and it was being
 * reassembled by hand each time — `<Eyebrow>`, then a heading with `mt-5`,
 * then a paragraph with `mt-4` or `mt-5` depending on the file. Eleven copies
 * of a three-element pattern is eleven chances for the spacing to drift, and
 * it had: the shop header used mt-4, the PDP mt-4, everything else mt-5.
 *
 * Callers that need something unusual still compose the parts directly — this
 * is the common case, not a mandate.
 */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  as = "h2",
  size = "m",
  align = "start",
  onDark = false,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** The paragraph under the heading. Kept narrow for a readable measure. */
  lede?: ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "xl" | "l" | "m" | "s";
  align?: "start" | "center";
  onDark?: boolean;
  className?: string;
  /** Anything extra below the lede — a link, a button row. */
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex max-w-xl flex-col",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <Eyebrow
          onDark={onDark}
          className={cn("mb-5", align === "center" && "items-center")}
        >
          {eyebrow}
        </Eyebrow>
      )}
      <SectionHeading as={as} size={size} className={cn(onDark && "text-on-inverted")}>
        {title}
      </SectionHeading>
      {lede && (
        <p
          className={cn(
            "mt-5 text-copy",
            onDark ? "text-on-inverted/70" : "text-ink-muted",
          )}
        >
          {lede}
        </p>
      )}
      {children}
    </div>
  );
}
