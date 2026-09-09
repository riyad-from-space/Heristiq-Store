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
        /* px-gutter is clamp(20px, 5vw, 56px) — one fluid gutter instead of a
           breakpoint step, so a 360px phone and a 700px tablet each get a
           margin in proportion to the text it is holding in. */
        "mx-auto w-full px-gutter",
        width === "default" && "max-w-wrap",
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
  tone = "blush",
  spacing = "default",
  as: As = "section",
  ...props
}: /* `ref` is omitted because the two tags disagree about it —
      Ref<HTMLElement> from the union is not assignable to Ref<HTMLDivElement>
      — and nothing here needs a ref. Everything else is identical between
      <section> and <div>. */
Omit<ComponentProps<"section">, "ref"> & {
  tone?: "blush" | "sand" | "inverted" | "white";
  spacing?: "default" | "none";
  as?: "section" | "div";
}) {
  return (
    <As
      className={cn(
        spacing === "default" && "py-section",
        tone === "sand" && "bg-sand",
        tone === "white" && "bg-white",
        tone === "inverted" && "bg-inverted text-on-inverted",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The kicker above a section heading.
 *
 * Was an all-caps label with a short gold rule beneath it — the old brand's
 * signature. This design has no rule: the mockup's kicker is rose, semibold,
 * lightly tracked, and that is the whole of it. The `rule` prop is gone
 * rather than ignored, so nothing can ask for a mark that no longer exists.
 */
export function Eyebrow({
  children,
  className,
  onDark = false,
}: {
  children: ReactNode;
  className?: string;
  /** On the plum band, where rose-deep has too little contrast. */
  onDark?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-eyebrow font-semibold",
        onDark ? "text-rose" : "text-rose-deep",
        className,
      )}
    >
      {children}
    </span>
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
  action,
  as = "h2",
  size = "m",
  align = "start",
  onDark = false,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** The subtitle under the heading. */
  lede?: ReactNode;
  /** A link or button pinned to the right, bottom-aligned with the heading. */
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "xl" | "l" | "m" | "s";
  align?: "start" | "center";
  onDark?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        /*
         * The mockup's .sec-head: the heading block and its action sit on one
         * row, bottom-aligned, and stack on a phone. `items-end` is what puts
         * a "See all" link on the heading's baseline rather than floating it
         * beside the block's centre.
         */
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5",
        align === "center" && "sm:flex-col sm:items-center",
        className,
      )}
    >
      <div
        className={cn(
          "max-w-xl",
          align === "center" && "mx-auto text-center",
        )}
      >
        {eyebrow && (
          <Eyebrow onDark={onDark} className="mb-3.5 block">
            {eyebrow}
          </Eyebrow>
        )}
        <SectionHeading
          as={as}
          size={size}
          className={cn(onDark && "text-on-inverted")}
        >
          {title}
        </SectionHeading>
        {lede && (
          <p
            className={cn(
              "mt-2 text-copy",
              onDark ? "text-on-inverted/80" : "text-stone",
            )}
          >
            {lede}
          </p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
