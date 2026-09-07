"use client";

import { useEffect, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";

/*
 * Page-enter transition.
 *
 * A template re-mounts on every navigation (a layout does not), which is what
 * makes it the right place for this — and also what makes the obvious version
 * of it a performance bug.
 *
 * The obvious version is `initial={{ opacity: 0 }}` on every render. Because
 * this wraps EVERY page, that puts `opacity: 0` on the entire document in the
 * server-rendered HTML — including the first page a customer ever loads. An
 * element at opacity 0 is unpainted, so Largest Contentful Paint would not be
 * recorded until the fade finished: a 320ms penalty on every cold visit, paid
 * by the Instagram traffic this shop actually lives on. It would also undo the
 * care taken in the hero to keep the headline paintable.
 *
 * So the first mount is not animated at all. The flag is module-scoped, and
 * the two environments both behave correctly for the same reason:
 *
 *   - on the server it is always false (effects never run there), so the HTML
 *     is emitted with no inline opacity — nothing to hide, nothing to delay,
 *     and the client's first render agrees with it, so no hydration mismatch;
 *   - after that first mount the effect flips it, and every subsequent
 *     navigation gets the transition.
 *
 * The result is a cold load that pays nothing and in-site navigation that
 * feels composed.
 */
let hasMountedOnce = false;

export default function Template({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  /* Read during render, before the effect below can change it. */
  const isFirstLoad = !hasMountedOnce;

  useEffect(() => {
    hasMountedOnce = true;
  }, []);

  if (reduced || isFirstLoad) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.calm, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
