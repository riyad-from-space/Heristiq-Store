/*
 * WCAG contrast for the whole palette.
 *
 * Every pair below is a real pairing that exists in src/. Nothing in
 * TypeScript, ESLint or the build knows that --color-stone on --color-sand has
 * stopped being readable, so this is the only thing that catches it.
 *
 *   node apps/store/scripts/contrast-test.mjs
 *
 * Thresholds are WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text and for
 * the boundaries of controls a customer must perceive. Decorative hairlines
 * are reported but not enforced — a 1px rule between two bands is not a
 * control and does not owe 3:1 — while anything carrying words or state is.
 *
 * It has already earned its place twice: the design brief's own palette put
 * body text on the sand band at 4.43:1 and the hero tag pill at 4.34:1, both
 * under AA and both missed by the brief's accessibility section.
 */

const PALETTE = {
  rose: "#d2697e",
  "rose-deep": "#a84a60",
  "rose-soft": "#f7e6e9",
  blush: "#fcf6f3",
  sand: "#f4e9e1",
  plum: "#2c1d24",
  "plum-2": "#3d2731",
  ink: "#2a2126",
  stone: "#6f6063",
  "stone-soft": "#8d7e81",
  line: "#ece0d9",
  "line-strong": "#ddcbc2",
  control: "#8a7b7e",
  inverted: "#2c1d24",
  "on-inverted": "#fcf6f3",
  white: "#ffffff",
  success: "#3d6b52",
  warn: "#8a5a26",
  danger: "#a33a3a",
  "success-wash": "#e9f0ec",
  "warn-wash": "#f8eddd",
  "danger-wash": "#fae9e8",
  "info-wash": "#f3ecee",
  "info-line": "#e0cdd3",
};

/* ── contrast maths ─────────────────────────────────────────────────────── */

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(m[1], 16);
  const r = srgbToLinear((n >> 16) & 255);
  const g = srgbToLinear((n >> 8) & 255);
  const b = srgbToLinear(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ── the pairs that actually exist in src/ ──────────────────────────────── */

const TEXT = 4.5;
const UI = 3;

const PAIRS = [
  // text on each of the three grounds
  ["ink", "blush", TEXT, "headings and body on the base"],
  ["ink", "white", TEXT, "body on a card"],
  ["ink", "sand", TEXT, "body on the secondary band"],
  ["stone", "blush", TEXT, "lead paragraphs and card meta"],
  ["stone", "white", TEXT, "meta on a card"],
  ["stone", "sand", TEXT, "the mood subtitles and the newsletter copy"],

  // the accent
  ["white", "rose-deep", TEXT, "white text on the solid button"],
  ["rose-deep", "blush", TEXT, "section links and '@heristiq'"],
  ["rose-deep", "sand", TEXT, "a section link on the sand band"],
  ["rose-deep", "rose-soft", TEXT, "the hero tag pill"],
  ["rose", "plum", TEXT, "the story kicker and its italic word"],
  ["rose", "blush", UI, "the wordmark's period, icons, the chain motif"],
  ["rose", "plum", UI, "focus ring on the dark band"],
  ["rose", "blush", UI, "focus ring on the base"],

  // the inverted band
  ["on-inverted", "inverted", TEXT, "the footer and story-band copy"],
  ["on-inverted", "plum", TEXT, "copy on the brand plum"],
  ["blush", "ink", TEXT, "the skip link and the ink badge"],

  // state
  ["success", "blush", TEXT, "'Free' delivery and paid credits"],
  ["success", "success-wash", TEXT, "success text on its panel"],
  ["warn", "blush", TEXT, "low-stock and demo-mode warnings"],
  ["warn", "warn-wash", TEXT, "warning text on its panel"],
  ["danger", "blush", TEXT, "checkout rejection and field errors"],
  ["danger", "white", TEXT, "a field error on a card"],
  ["danger", "danger-wash", TEXT, "the order-rejected banner"],

  // controls a customer must be able to perceive
  ["control", "white", UI, "input and select borders"],
  ["control", "blush", UI, "an input border on the base"],
  ["control", "sand", UI, "the newsletter input on the sand band"],

  // decorative only: reported, not enforced
  ["line", "blush", null, "hairline on the base"],
  ["line", "sand", null, "hairline on the sand band"],
  ["line-strong", "blush", null, "the heavier decorative rule"],
  ["info-line", "info-wash", null, "the pre-order panel's edge"],
];

/* ── run ─────────────────────────────────────────────────────────────────── */

let failures = 0;
let warnings = 0;

for (const [fg, bg, min, what] of PAIRS) {
  const a = PALETTE[fg];
  const b = PALETTE[bg];
  if (!a || !b) {
    console.log(`  ????  ${fg} on ${bg} — token missing from the palette`);
    failures++;
    continue;
  }
  const ratio = contrast(a, b);
  const r = ratio.toFixed(2).padStart(5);
  if (min === null) {
    const ok = ratio >= 1.15;
    if (!ok) warnings++;
    console.log(`  ${ok ? "note" : "WARN"}  ${r}:1  ${fg} on ${bg} — ${what}`);
  } else {
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(
      `  ${ok ? " ok " : "FAIL"}  ${r}:1  (need ${min})  ${fg} on ${bg} — ${what}`,
    );
  }
}

/*
 * The elevation ladder: sand sits BELOW the base and white ABOVE it, so a
 * "raised" card never reads as a hole. Checked as an invariant rather than a
 * pair, because ordering is the thing that has to hold, not a ratio.
 */
const l = (k) => luminance(PALETTE[k]);
const ordered = l("sand") < l("blush") && l("blush") < l("white");
if (!ordered) failures++;
console.log(
  `\n  ${ordered ? " ok " : "FAIL"}  elevation: sand ${l("sand").toFixed(4)} < blush ` +
    `${l("blush").toFixed(4)} < white ${l("white").toFixed(4)}`,
);

/* And the ink hierarchy stays a hierarchy: primary louder than secondary,
   secondary louder than tertiary, against the base. */
const inkOrder =
  contrast(PALETTE.ink, PALETTE.blush) > contrast(PALETTE.stone, PALETTE.blush) &&
  contrast(PALETTE.stone, PALETTE.blush) >
    contrast(PALETTE["stone-soft"], PALETTE.blush);
if (!inkOrder) failures++;
console.log(
  `  ${inkOrder ? " ok " : "FAIL"}  ink hierarchy: ink ` +
    `${contrast(PALETTE.ink, PALETTE.blush).toFixed(2)} > stone ` +
    `${contrast(PALETTE.stone, PALETTE.blush).toFixed(2)} > stone-soft ` +
    `${contrast(PALETTE["stone-soft"], PALETTE.blush).toFixed(2)}`,
);

console.log(
  `\n${failures ? `${failures} FAILURE(S)` : "all enforced pairs pass"}` +
    `${warnings ? `, ${warnings} warning(s)` : ""}\n`,
);
process.exit(failures ? 1 : 0);
