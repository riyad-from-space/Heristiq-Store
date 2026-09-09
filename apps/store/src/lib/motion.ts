/**
 * The brand's motion, as numbers.
 *
 * These mirror the --duration-* and --ease-out-soft tokens in globals.css.
 * They have to be duplicated because CSS custom properties are strings and
 * `motion` wants seconds and a cubic-bezier array — but duplicated in ONE
 * place, so a hover transition and a scroll reveal on the same element cannot
 * disagree about how this site moves. Change a value here and in globals.css
 * together.
 *
 * Seconds, not milliseconds: that is what motion takes.
 */
export const DURATION = {
  quick: 0.15,
  calm: 0.25,
  slow: 0.5,
} as const;

/** The decelerate curve, matching the mockup's cubic-bezier(.2,.7,.2,1). */
export const EASE = [0.2, 0.7, 0.2, 1] as const;

/**
 * How far a revealing element travels. 14px — far enough to read as movement,
 * near enough that a mis-timed reveal does not look like a layout bug.
 *
 * Deliberately small for another reason: a large translate on a long section
 * means the element is off its final position while the browser is still
 * settling the page, and on a slow phone that is indistinguishable from
 * layout shift.
 */
export const REVEAL_Y = 14;

/**
 * The stagger between siblings. 60ms reads as one gesture arriving in parts;
 * beyond ~90ms it reads as separate things happening, which on a product grid
 * feels like a slow page rather than a considered one.
 */
export const STAGGER = 0.06;

/**
 * Shared variants for the reveal pair.
 *
 * `hidden`/`shown` rather than motion's `initial`/`animate` literals, because
 * a parent with `staggerChildren` propagates variant NAMES to its children —
 * the child cannot be handed an object.
 */
export const revealVariants = {
  hidden: { opacity: 0, y: REVEAL_Y },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE },
  },
} as const;

/**
 * The same, minus the fade — for text that is or may be the LCP element.
 *
 * An element at `opacity: 0` has not been painted, so the browser records its
 * Largest Contentful Paint only when the fade finishes. Fading in a hero
 * headline therefore adds the whole animation duration to the metric that
 * decides whether the page felt fast, on the one element most likely to BE
 * that metric. Moving it costs nothing: a transform paints immediately and is
 * composited off the main thread.
 */
export const riseVariants = {
  hidden: { y: REVEAL_Y },
  shown: {
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE },
  },
} as const;

/** Parent-only variants: no visual change, just a clock for the children. */
export const staggerVariants = {
  hidden: {},
  shown: {
    transition: { staggerChildren: STAGGER, delayChildren: 0.05 },
  },
} as const;
