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



/**
 * A section that arrives as it scrolls into view.
 *
 * WHY THIS EXISTS NOW, having been deliberately removed before. The note at
 * the top of this file is still right: fade-up on EVERY section reads as
 * generic, and a page where nothing is ever simply present feels slow. So
 * this is not applied everywhere — it goes on the bands that introduce a new
 * idea, and never on the hero (already animated on load) or on anything above
 * the fold.
 *
 * Three things keep it from being the generic version:
 *
 *  - `once: true`. A section that re-animates every time it scrolls past is
 *    the thing that makes a page feel like a slideshow.
 *  - `amount: 0.15` with a negative bottom margin, so it fires just BEFORE
 *    the section is properly in view. Waiting until 50% is visible means the
 *    reader watches it animate; firing early means it is simply there by the
 *    time they arrive, which is the difference between motion and delay.
 *  - It moves 14px, the same REVEAL_Y as the hero. Anything further reads as
 *    a slide rather than a settle.
 *
 * `data-reveal` is not decoration: it is what the CSS in globals.css and the
 * <noscript> block in the root layout key off, so this content is forced
 * visible at FIRST PAINT for reduced-motion and JS-off readers. Without it,
 * motion's server-rendered `opacity: 0` would hide the section permanently
 * for both. See the long note at the top of this file.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds. For a second element that should follow the first. */
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      data-reveal
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -12% 0px" }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
