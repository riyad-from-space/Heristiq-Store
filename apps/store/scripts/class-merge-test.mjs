/*
 * Guards lib/utils.ts's tailwind-merge configuration.
 *
 * tailwind-merge resolves conflicts by class group and never reads the
 * stylesheet, so it cannot tell that `text-display-m` is a font size while
 * `text-bone` is a colour — both are custom `text-*` classes. Left
 * unconfigured it files both under text-color and DELETES the size:
 *
 *   twMerge("text-display-m text-bone") -> "text-bone"
 *
 * That produced headings and body copy silently rendering at the inherited
 * size, with the correct classes sitting right there in the source and no
 * error from TypeScript, ESLint or the build. Nothing catches it but the eye,
 * which is why it survived until a section heading landed next to a colour.
 *
 * So this asserts the behaviour directly. Run it after adding a size to the
 * @theme block — the new token must be added to FONT_SIZES in lib/utils.ts or
 * it will be thrown away wherever it meets a text colour.
 *
 *   node apps/store/scripts/class-merge-test.mjs
 */
import { cn } from "../src/lib/utils.ts";

const cases = [
  {
    label: "size + colour both survive (heading on dark)",
    got: () => cn("font-display font-normal text-display-m", "mt-5 text-bone"),
    want: ["text-display-m", "text-bone"],
    absent: [],
  },
  {
    label: "size + colour both survive (section lede)",
    got: () => cn("mt-5 text-copy", "text-ink-muted"),
    want: ["text-copy", "text-ink-muted"],
    absent: [],
  },
  {
    label: "eyebrow token survives a colour",
    got: () => cn("text-eyebrow font-medium uppercase", "text-ink-muted"),
    want: ["text-eyebrow", "text-ink-muted"],
    absent: [],
  },
  {
    label: "alpha-modified colour does not eat the size",
    got: () => cn("mt-2 text-copy-sm", "text-bone/70"),
    want: ["text-copy-sm", "text-bone/70"],
    absent: [],
  },
  {
    label: "a later custom size still overrides an earlier one",
    got: () => cn("text-copy", "text-copy-lg"),
    want: ["text-copy-lg"],
    absent: ["text-copy"],
  },
  {
    label: "a later colour still overrides an earlier one",
    got: () => cn("text-ink", "text-gold"),
    want: ["text-gold"],
    absent: ["text-ink"],
  },
  {
    label: "Tailwind's own sizes still merge",
    got: () => cn("text-sm", "text-base"),
    want: ["text-base"],
    absent: ["text-sm"],
  },
  {
    label: "display sizes override each other",
    got: () => cn("text-display-xl", "text-display-s"),
    want: ["text-display-s"],
    absent: ["text-display-xl"],
  },
];

let failed = 0;
for (const { label, got, want, absent } of cases) {
  const out = got();
  const parts = out.split(/\s+/);
  const missing = want.filter((c) => !parts.includes(c));
  const present = absent.filter((c) => parts.includes(c));
  const ok = missing.length === 0 && present.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) {
    console.log(`        got: "${out}"`);
    if (missing.length) console.log(`        missing: ${missing.join(", ")}`);
    if (present.length) console.log(`        should be gone: ${present.join(", ")}`);
  }
}

console.log(
  `\n${cases.length - failed}/${cases.length} passed` +
    (failed ? " — FAILED" : ""),
);
process.exit(failed ? 1 : 0);
