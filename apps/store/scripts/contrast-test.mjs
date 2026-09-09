/*
 * WCAG contrast for the whole palette, in both themes.
 *
 * This exists because dark mode here is a TOKEN SWAP: components keep their
 * classes and the values underneath change. That is what keeps the migration
 * small, and it is also what makes contrast easy to break silently — nothing
 * in TypeScript, ESLint, or the build knows that --color-ink-muted at its dark
 * value has stopped being readable on --color-paper.
 *
 * Every pair below is a real pairing that exists in src/. When a token value
 * changes, run this:
 *
 *   node apps/store/scripts/contrast-test.mjs
 *
 * Thresholds are WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text (>=24px
 * or >=19px bold) and for the boundaries of controls a user must perceive.
 * Decorative hairlines are checked but only warned about — a 1px rule between
 * two bands is not a control and does not owe 3:1 — while anything carrying
 * words or state is enforced.
 */

/* ── the palette, mirroring the @theme and dark blocks in globals.css ────── */

const LIGHT = {
  bone: "#faf7f2",
  paper: "#fffdfa",
  shell: "#f2ece1",
  ink: "#17150f",
  "ink-muted": "#6a635a",
  "ink-faint": "#8a8177",
  gold: "#a08149",
  "gold-strong": "#7d6135",
  "gold-wash": "#f0e7d5",
  control: "#8d857a",
  sea: "#1b2c36",
  inverted: "#1b2c36",
  "on-inverted": "#faf7f2",
  line: "#e5ddd0",
  "line-strong": "#cfc4b1",
  success: "#3f6b4f",
  "success-wash": "#e8efe9",
  warn: "#8a5d26",
  "warn-wash": "#f6ecdd",
  danger: "#8f3b32",
  "danger-wash": "#f7e7e4",
};

const DARK = {
  /*
   * Ground is #12100e, not pure black and not the #100f0d first sketched.
   * Two reasons: a warm near-black keeps the bone-and-gold brand from turning
   * blue-grey, and leaving a little room above pure black is what lets `shell`
   * stay genuinely recessed below it.
   */
  bone: "#12100e",
  /* Raised. Must stay LIGHTER than the ground, and by a wider margin than in
     light mode — a 0.05 luminance step reads as a lifted card on bone and is
     invisible near black. */
  paper: "#26221c",
  /* Recessed, and deliberately BELOW the ground, preserving the light-mode
     role: image wells and quiet bands are holes, not cards. */
  shell: "#1c1915",
  /* Warm off-white, never #ffffff — pure white on a warm near-black is the
     standard cheap-dark-mode tell, and it thickens Fraunces' strokes. */
  ink: "#f2eee6",
  /* LIGHTENS from its light value. */
  "ink-muted": "#a9a196",
  /* DARKENS. In light, faint is lighter than muted; in dark it must be darker,
     or placeholders and disabled text read louder than captions. Getting this
     backwards is what a blanket "lighten all the inks" pass does. */
  "ink-faint": "#6f685e",
  /* The accent is the one token that gets BETTER in dark. A small lift keeps
     it reading as metal rather than mustard. */
  gold: "#c1a068",
  /* Goes LIGHTER in dark. Same direction as the light value goes darker:
     both are "more contrast against my own ground", which is why the token is
     named `strong` rather than `deep` — "deep" is only true in light mode. */
  "gold-strong": "#d9bc8a",
  /* A dark gold-tinted plate, not a cream slab. */
  "gold-wash": "#2b2317",
  control: "#7c7469",
  /* Brand navy stays put — it is a literal colour (the hero ground, the
     lightbox scrim), not a role. */
  sea: "#1b2c36",
  /* The inverted-band ROLE goes the other way: lighter than the ground, so
     the footer and feature bands stay distinguishable surfaces. */
  inverted: "#25353f",
  /* Text on a permanently dark surface. Light in BOTH themes — that is the
     entire point of splitting it out of `bone`. */
  "on-inverted": "#faf7f2",
  line: "#332f29",
  "line-strong": "#4a443c",
  success: "#7fb894",
  "success-wash": "#16211a",
  warn: "#d3a05e",
  "warn-wash": "#251c11",
  danger: "#e0857a",
  "danger-wash": "#2a1815",
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
const LARGE = 3;
const UI = 3;

const PAIRS = [
  // body and heading text on all three grounds
  ["ink", "bone", TEXT, "body text on the page ground"],
  ["ink", "paper", TEXT, "body text on a card"],
  ["ink", "shell", TEXT, "body text on a quiet band"],
  ["ink-muted", "bone", TEXT, "captions and prose body on the ground"],
  ["ink-muted", "paper", TEXT, "captions on a card"],
  ["ink-muted", "shell", TEXT, "captions on a band (motif story, PDP related)"],

  // accent
  ["gold", "bone", LARGE, "gold rule and marks on the ground"],
  ["gold", "paper", LARGE, "gold on a card"],
  ["gold", "shell", UI, "gold rules and icons on a band (non-text)"],
  ["gold-strong", "gold-wash", TEXT, "badge tone=gold, and the 5 gold-wash notice panels"],
  ["gold-strong", "bone", TEXT, "gold that carries words (eyebrow labels, notices)"],
  ["gold-strong", "shell", TEXT, "gold words on a quiet band (motif story labels)"],
  ["gold", "inverted", UI, "focus ring on an inverted band"],
  ["gold", "bone", UI, "focus ring on the ground"],

  // inverted surfaces — the split token is what makes these work
  ["on-inverted", "inverted", TEXT, "footer and feature-band text"],
  ["on-inverted", "sea", TEXT, "lightbox chrome and hero copy on brand navy"],

  // the ink/bone plate, which swaps sides between themes
  ["bone", "ink", TEXT, "skip link, sticky bar, filter bar: text on an ink plate"],

  // state colours as text
  ["success", "bone", TEXT, "'Free' delivery and paid credits"],
  ["success", "paper", TEXT, "success text on a card"],
  ["success", "success-wash", TEXT, "success text on its panel"],
  ["warn", "bone", TEXT, "low-stock and demo-mode warnings"],
  ["warn", "warn-wash", TEXT, "warning text on its panel"],
  ["danger", "bone", TEXT, "checkout rejection and field errors"],
  ["danger", "paper", TEXT, "field errors on a card"],
  ["danger", "danger-wash", TEXT, "the order-rejected banner"],

  // controls a customer must be able to perceive
  ["control", "bone", UI, "input and select borders on the ground"],
  ["control", "paper", UI, "input borders on a card"],
  ["line-strong", "bone", null, "heavier decorative rule"],

  // decorative hairlines: warn only
  ["line", "bone", null, "hairline on the ground"],
  ["line", "paper", null, "hairline on a card"],
  ["line", "shell", null, "hairline on a band"],
];

/* ── run ────────────────────────────────────────────────────────────────── */

let failures = 0;
let warnings = 0;

for (const [themeName, theme] of [
  ["LIGHT", LIGHT],
  ["DARK", DARK],
]) {
  console.log(`\n${"═".repeat(78)}\n  ${themeName}\n${"═".repeat(78)}`);
  for (const [fg, bg, min, what] of PAIRS) {
    const a = theme[fg];
    const b = theme[bg];
    if (!a || !b) {
      console.log(`  ????  ${fg} on ${bg} — token missing from ${themeName}`);
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
}

/*
 * The elevation ladder.
 *
 * The DIRECTION differs by theme and that is intended: light has room below
 * the ground for a recessed band, near-black does not (a genuinely recessed
 * shell measured 1.04:1 — ordered, but invisible). What must hold in both is
 * that paper is the highest surface and that every step is PERCEPTIBLE, so
 * this checks ordering per theme plus a minimum step size. Ordering alone
 * passed while the dark page looked like one flat slab.
 */
/*
 * The minimum perceptible fill step, and why it is DARK-only.
 *
 * In light mode a card is defined by its hairline, not its fill: bone #faf7f2
 * against paper #fffdfa is 1.05:1 by design, and the border does the work.
 * That is a deliberate choice in this design and enforcing a step there would
 * mean grubbying the paper for no gain.
 *
 * In dark the hairline is far weaker relative to its surroundings, so the fill
 * has to carry the surface itself — which is exactly the failure this catches:
 * an ordered-but-invisible ladder that rendered the page as one flat slab.
 */
const MIN_STEP = { LIGHT: 1.0, DARK: 1.06 };
console.log(`\n${"═".repeat(78)}\n  ELEVATION ORDER\n${"═".repeat(78)}`);
for (const [themeName, theme] of [
  ["LIGHT", LIGHT],
  ["DARK", DARK],
]) {
  const shell = luminance(theme.shell);
  const ground = luminance(theme.bone);
  const paper = luminance(theme.paper);
  const inverted = luminance(theme.inverted);
  /* light: shell below the ground. dark: both above it. paper highest in both. */
  const ordered =
    themeName === "LIGHT"
      ? shell < ground && ground < paper
      : ground < shell && shell < paper;
  const groundToShell = contrast(theme.shell, theme.bone);
  const groundToPaper = contrast(theme.paper, theme.bone);
  const step = MIN_STEP[themeName];
  const visible = groundToShell >= step && groundToPaper >= step;
  const ok = ordered && visible;
  if (!ok) failures++;
  console.log(
    `  ${ok ? " ok " : "FAIL"}  ${themeName}: ordered=${ordered}  ` +
      `ground->shell ${groundToShell.toFixed(3)}:1  ground->paper ${groundToPaper.toFixed(
        3,
      )}:1  (need ${step}, inverted ${inverted.toFixed(4)})`,
  );
}
/* And the ink hierarchy must stay a hierarchy: primary louder than secondary,
   secondary louder than tertiary, measured against each theme's own ground. */
for (const [themeName, theme] of [
  ["LIGHT", LIGHT],
  ["DARK", DARK],
]) {
  const primary = contrast(theme.ink, theme.bone);
  const secondary = contrast(theme["ink-muted"], theme.bone);
  const tertiary = contrast(theme["ink-faint"], theme.bone);
  const ok = primary > secondary && secondary > tertiary;
  if (!ok) failures++;
  console.log(
    `  ${ok ? " ok " : "FAIL"}  ${themeName}: ink ${primary.toFixed(2)} > muted ${secondary.toFixed(
      2,
    )} > faint ${tertiary.toFixed(2)}`,
  );
}

console.log(
  `\n${failures ? `${failures} FAILURE(S)` : "all enforced pairs pass"}` +
    `${warnings ? `, ${warnings} warning(s)` : ""}\n`,
);
process.exit(failures ? 1 : 0);
