"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import {
  DURATION,
  EASE,
  revealVariants,
  riseVariants,
  staggerVariants,
  VIEWPORT,
} from "@/lib/motion";

/*
 * Scroll reveals and stagger, as three small wrappers.
 *
 * These are the ONLY client components in the animation layer, and they take
 * their content as `children`. That matters: everything inside stays a server
 * component, so wrapping the product grid in a stagger does not drag the
 * catalogue, the price formatting or lucide's icons into the browser bundle.
 * The wrapper ships; the content does not.
 *
 * ---------------------------------------------------------------------------
 * The SSR problem, and why the fix is in CSS
 *
 * `motion` renders an element's `initial` state as an inline style during
 * server rendering. So `initial="hidden"` means the HTML arrives with
 * `opacity: 0` — and if JavaScript never runs, or has not run yet, the
 * content is invisible. Two populations get hurt by that: someone with JS
 * off or blocked, and someone who asked their OS for reduced motion (whose
 * preference `useReducedMotion` cannot know until hydration).
 *
 * Guarding it in JavaScript cannot work, because the damage is done before
 * any JavaScript runs. So the guard is CSS, in globals.css, keyed off the
 * `data-reveal` attribute every wrapper below sets:
 *
 *   - a `prefers-reduced-motion: reduce` block forces these visible with
 *     !important, which beats motion's inline style and applies at FIRST
 *     PAINT rather than at hydration;
 *   - a <noscript> block in the root layout does the same for JS-off.
 *
 * Both are declarative and both win over the inline style, so the hidden
 * state only ever exists for someone who can actually see it animate away.
 * The early return below is then just an optimisation — it stops the
 * animation from running at all once hydration confirms the preference.
 */

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before starting. Use sparingly. */
  delay?: number;
  /**
   * Move without fading, for text that could be the LCP element. An element
   * at opacity 0 is unpainted, so a fade defers the metric by its own
   * duration. See riseVariants.
   */
  rise?: boolean;
};

/** A single block that fades and rises when it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  rise = false,
}: RevealProps) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      data-reveal
      className={className}
      variants={rise ? riseVariants : revealVariants}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A parent whose direct <StaggerItem> children arrive in sequence.
 *
 * The parent has no visual state of its own — it is a clock. Children are
 * driven by variant NAME propagation, which is why the variants in lib/motion
 * are named `hidden`/`shown` instead of being passed as objects.
 */
export function Stagger({
  children,
  className,
  delay = 0,
  /** Animate on mount instead of on scroll — for above-the-fold content. */
  onMount = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  onMount?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      data-reveal
      className={className}
      variants={staggerVariants}
      initial="hidden"
      {...(onMount
        ? { animate: "shown" }
        : { whileInView: "shown", viewport: VIEWPORT })}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/** One child of a <Stagger>. */
export function StaggerItem({
  children,
  className,
  rise = false,
}: {
  children: ReactNode;
  className?: string;
  /** See RevealProps.rise — set this on a heading that may be the LCP. */
  rise?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      data-reveal
      className={className}
      variants={rise ? riseVariants : revealVariants}
    >
      {children}
    </motion.div>
  );
}

/**
 * A grid or rail whose cells arrive in sequence.
 *
 * Separate from <Stagger> only because a product grid needs its own gap and
 * grid classes on the animating element itself — wrapping the grid in an
 * extra div would break `grid-cols-*` on the child.
 */
export function StaggerGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      data-reveal
      className={className}
      variants={staggerVariants}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

/**
 * A cell inside <StaggerGrid>.
 *
 * Product cards fade only — no rise. A grid of cells each travelling 14px
 * upward reads as the layout settling rather than as content arriving, and on
 * a two-column phone grid it is enough movement to look like a bug.
 */
export function StaggerCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      data-reveal
      className={className}
      variants={{
        hidden: { opacity: 0 },
        shown: {
          opacity: 1,
          transition: { duration: DURATION.calm, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
