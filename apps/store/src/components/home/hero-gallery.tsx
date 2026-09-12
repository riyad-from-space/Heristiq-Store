"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ui/product-image";
import { DURATION, EASE } from "@/lib/motion";
import type { ProductImage as ImageRef } from "@/lib/erp/types";

/*
 * The hero's photograph, changing to the next one on its own.
 *
 * ONE FRAME, not a row of thumbnails. The brief was "featured images one by
 * one" with "enough visual impact to grab attention", and those pull in
 * opposite directions if the images share the space — three pictures at a
 * third of the width each is a contact sheet, and a contact sheet is the
 * opposite of impact. So the frame stays the size it was and the pictures take
 * turns in it.
 *
 * HOW THE TRANSITION WORKS, and why it is not a fade.
 *
 * A plain crossfade passes through a moment where both images are half
 * transparent and the background shows through both. On a dark photograph
 * against a pale page that middle frame is visibly washed out, and it is the
 * frame the eye lands on. Here the outgoing image holds still and the incoming
 * one arrives ON TOP of it — so there is never a frame with nothing solid in
 * it. The incoming image also starts 4% larger and settles to its true size,
 * which is slow enough to read as the picture coming to rest rather than as a
 * zoom.
 *
 * Seven seconds, not three. Long enough to look at a piece of jewellery, and
 * infrequent enough that a reader working down the copy is not being
 * interrupted from the corner of their eye. Motion in a hero competes with the
 * headline beside it; the way to stop it winning is to let it move rarely.
 *
 * ACCESSIBILITY AND THE FIRST PAINT. The first image is rendered plainly, not
 * through AnimatePresence, and carries `priority` — it is the LCP element on
 * this page, and an element at opacity 0 has not been painted, so animating
 * the first one in would push the metric out by the animation's duration on
 * the connection least able to afford it. Reduced motion gets that first frame
 * and nothing else: no cycling, no animation, no timer.
 */
export function HeroGallery({ images }: { images: readonly ImageRef[] }) {
  const reduced = useReducedMotion();

  /*
   * BOTH indices, in one piece of state.
   *
   * `previous` is what sits solid underneath; `current` is what fades in on
   * top. Tracking only `current` and leaving image 0 permanently underneath
   * looked right until the cycle wrapped: going from the last image back to
   * the first, the top layer unmounted and image 0 appeared instantly — a
   * hard cut, once every cycle, in the one animation on the page that exists
   * to be smooth.
   *
   * They start equal, which is how the first paint renders exactly one image
   * and no overlay at all.
   */
  const [frame, setFrame] = useState({ current: 0, previous: 0 });

  /* One frame only: nothing to cycle, and no timer to leak. */
  const cycling = !reduced && images.length > 1;

  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => {
      setFrame((f) => ({
        current: (f.current + 1) % images.length,
        previous: f.current,
      }));
    }, 7000);
    return () => clearInterval(id);
  }, [cycling, images.length]);

  const beneath = images[frame.previous] ?? images[0];
  const above = images[frame.current];
  if (!beneath || !above) return null;

  return (
    <div className="relative">
      {/*
       * The base layer, always the FIRST image and never animated.
       *
       * It does two jobs: it is the LCP element, painted immediately; and it
       * is what sits underneath every transition, so the frame is never empty
       * and the layout never has to reserve height separately — the stack's
       * height is this element's height.
       */}
      <ProductImage
        image={beneath}
        sizes="(min-width: 1024px) 52vw, 100vw"
        crop="portrait"
        /* Only the very first paint is the LCP element. Once the gallery has
           moved on, `priority` on a mid-cycle image would be a fetch
           instruction for something already on screen. */
        priority={frame.previous === 0 && frame.current === 0}
        maxWidth={1440}
        className="rounded-media"
      />

      {cycling && (
        <AnimatePresence initial={false}>
          {frame.current !== frame.previous && (
            <motion.div
              /* Keyed by index so each arrival is a new element — that is what
                 AnimatePresence needs to animate it in. */
              key={frame.current}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              /* No exit fade. The next image lands on top of this one, so
                 fading this one out would expose the base layer through it —
                 a flash of the wrong picture between two right ones. */
              transition={{ duration: DURATION.slow * 2.5, ease: EASE }}
            >
              <ProductImage
                image={above}
                sizes="(min-width: 1024px) 52vw, 100vw"
                crop="portrait"
                maxWidth={1440}
                className="rounded-media h-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/*
       * Which one is showing. Small, low-contrast, bottom-left — it is
       * orientation, not a control.
       *
       * aria-hidden and not buttons: everything these images show is one tap
       * away in /shop, so making them operable would add three tab stops to
       * the top of the page that lead nowhere a keyboard user cannot already
       * reach faster.
       */}
      {cycling && (
        <div aria-hidden className="absolute bottom-4 left-4 z-2 flex gap-1.5">
          {images.map((image, i) => (
            <span
              key={image.id}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === frame.current ? "w-6 bg-white" : "w-1.5 bg-white/55"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
