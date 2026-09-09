"use client";

import * as RadixToast from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";

/*
 * The confirmation pill.
 *
 * Radix Toast rather than a hand-rolled fixed div, and the difference is not
 * styling. Radix gives this an aria-live region that announces the message
 * without moving focus, a swipe-to-dismiss gesture, a timer that pauses when
 * the window loses focus, and correct behaviour when two confirmations land
 * close together. A plain div with a setTimeout gets the look and none of
 * that — and a wishlist heart that says nothing to a screen-reader user is a
 * control with no feedback at all.
 *
 * @radix-ui/react-toast was already a dependency and, until now, never
 * imported.
 *
 * One toast at a time, on purpose. Tapping four hearts in a grid should leave
 * one pill saying the last thing that happened, not stack four.
 */

type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  /* Bumped on every show so a repeat message still re-triggers the animation
     and re-announces — Radix keys the timer off the element, so without this
     a second identical toast would be a no-op. */
  const [nonce, setNonce] = useState(0);
  const reduced = useReducedMotion();

  const show = useCallback((next: string) => {
    setMessage(next);
    setNonce((n) => n + 1);
  }, []);

  const value = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="down" duration={2200}>
        {children}

        <AnimatePresence>
          {message !== null && (
            <RadixToast.Root
              key={nonce}
              open
              onOpenChange={(open) => {
                if (!open) setMessage(null);
              }}
              asChild
              forceMount
            >
              <motion.div
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: DURATION.calm, ease: EASE }}
                className="bg-ink text-on-inverted rounded-pill px-6 py-3 text-sm font-medium shadow-[0_18px_40px_-24px_rgba(42,33,38,.7)]"
              >
                <RadixToast.Title>{message}</RadixToast.Title>
              </motion.div>
            </RadixToast.Root>
          )}
        </AnimatePresence>

        {/*
         * The viewport is the fixed, positioned element; the pill inside it is
         * laid out normally. Separating them is what lets the pill animate on
         * transform without fighting the centring — a fixed element with
         * `left: 50%; translateX(-50%)` cannot also animate translateY
         * cleanly without composing both transforms by hand.
         *
         * pb for the iPhone home indicator, which otherwise sits over the pill.
         */}
        <RadixToast.Viewport className="fixed inset-x-0 bottom-0 z-100 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return context;
}
