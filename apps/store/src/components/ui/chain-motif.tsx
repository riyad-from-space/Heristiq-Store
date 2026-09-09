/*
 * The chain motif.
 *
 * A draped curve of small links, drawn in `currentColor` so it takes its
 * colour from whatever it sits inside — which is the whole point: it appears
 * over five different gradient placeholders and, later, over photography, and
 * none of those should need their own copy of it.
 *
 * `preserveAspectRatio="xMidYMid slice"` makes it behave like a background
 * image rather than a diagram: it fills its box and crops, so the same motif
 * works in a 4:4.4 hero block, a 3:3.7 collection tile and a 1:1 Instagram
 * square without stretching the links into ovals.
 *
 * Purely decorative, hence aria-hidden and focusable={false} — the second is
 * not redundant, because IE-era SVG defaults still put SVG elements in the
 * tab order in some engines, and a decorative flourish should never be a tab
 * stop.
 *
 * Not a server/client concern: no state, no props beyond className, so it
 * renders wherever it is used.
 */
export function ChainMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable={false}
      className={className}
    >
      {/* The thread. Deliberately thinner than the links so the eye reads
          beads on a line rather than a dotted stroke. */}
      <path
        d="M-10,60 Q60,140 130,70 T270,90 T410,60"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        opacity={0.85}
      />
      {/* The links. Varied radii, because a run of identical circles reads as
          a progress indicator; slight irregularity reads as jewellery. */}
      <g fill="currentColor" opacity={0.9}>
        <circle cx={20} cy={86} r={3.4} />
        <circle cx={58} cy={112} r={3} />
        <circle cx={96} cy={96} r={4} />
        <circle cx={130} cy={70} r={3.2} />
        <circle cx={172} cy={84} r={3} />
        <circle cx={210} cy={94} r={3.6} />
        <circle cx={250} cy={86} r={3} />
        <circle cx={292} cy={76} r={3.4} />
        <circle cx={336} cy={70} r={3} />
        <circle cx={378} cy={64} r={3.6} />
      </g>
    </svg>
  );
}
