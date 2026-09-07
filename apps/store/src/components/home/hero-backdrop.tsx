"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/*
 * The hero's background layers, with a slow parallax.
 *
 * This is a client component and the copy above it is not, which is the whole
 * point of splitting them: the backdrop needs a scroll position, the headline
 * does not, and the headline is the part that must be in the HTML.
 *
 * Being a client component does NOT cost the image its priority. Client
 * components are still server-rendered, so the <img> — with fetchPriority
 * and its srcset — is in the initial HTML exactly as before, and the
 * preload scanner finds it before React has loaded.
 */
export function HeroBackdrop({
  image,
}: {
  /** Pre-resolved on the server. null until a hero photograph exists. */
  image: { src: string; srcSet?: string } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  /*
   * offset ["start start", "end start"]: 0 when the hero's top edge meets the
   * viewport's top edge (which is where it starts, since the hero is the top
   * of the page), 1 when its bottom edge has scrolled up to that same line.
   * So the whole animation happens across exactly the hero's own height.
   */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  /*
   * The backdrop travels 14% of its height while the hero scrolls past, and
   * the layer is 118% tall so that 14% never exposes the section's edge.
   *
   * It also scales very slightly, because a pure translate on a photograph
   * with a level horizon reads as the image sliding in its frame; a touch of
   * zoom reads as depth.
   */
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  /* Reduced motion: render the same layers, no MotionValues bound. */
  const style = reduced ? undefined : { y, scale };

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.div
        aria-hidden
        style={style}
        /* -top-[9%] h-[118%] centres the oversized layer, so the parallax has
           room to move in both directions without a gap appearing. */
        className="absolute inset-x-0 -top-[9%] h-[118%] will-change-transform"
      >
        {image && (
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        )}

        {/* The celestial field: two radial washes and a fine dot grid. Cheap,
            resolution-independent, and it reads as night sky rather than as a
            gradient. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 70% 15%, rgba(164,133,76,0.28), transparent 70%)," +
              "radial-gradient(ellipse 60% 50% at 10% 90%, rgba(47,71,83,0.9), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(250,247,242,0.55) 0.5px, transparent 0.5px)",
            backgroundSize: "34px 34px",
          }}
        />
      </motion.div>

      {/*
       * The scrim stays OUTSIDE the moving layer. It exists to keep the copy
       * legible, so it has to stay welded to the bottom of the section — if
       * it parallaxed with the image, the text would lose its backing exactly
       * when the reader started scrolling.
       */}
      <div
        aria-hidden
        className="from-sea via-sea/70 absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"
      />
    </div>
  );
}
