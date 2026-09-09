"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import {
  revealVariants,
  riseVariants,
  staggerVariants,
} from "@/lib/motion";

/*
 * The hero's entrance, as two small wrappers.
 *
 * This file used to export five: whole-section scroll reveals and staggered
 * grids as well. The approved design deliberately removed them — one
 * orchestrated moment on load, and interaction feedback everywhere else, on
 * the grounds that fade-up-on-scroll applied to every section reads as
 * generic. Only the hero animates now, so only the hero's two wrappers
 * remain.
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
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      data-reveal
      className={className}
      variants={staggerVariants}
      initial="hidden"
      /* Always on mount. The scroll-triggered branch this used to have is
         gone with the section reveals — the hero is above the fold by
         definition, and a whileInView trigger on the first screen is a race
         between the observer and the reader. */
      animate="shown"
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


