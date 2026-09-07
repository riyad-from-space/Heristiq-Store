import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * The custom font sizes from the @theme block, declared to tailwind-merge.
 *
 * Without this, tailwind-merge silently deletes them. It resolves conflicts by
 * class GROUP, and it has no access to the stylesheet — so faced with
 * `text-display-m text-bone` it sees two classes beginning `text-`, cannot
 * know that one is a font size and the other a colour, files both under
 * text-color, and drops the earlier one as a conflict:
 *
 *   twMerge("text-display-m text-bone")          -> "text-bone"
 *   twMerge("mt-5 text-copy text-ink-muted")     -> "mt-5 text-ink-muted"
 *
 * Which is exactly what a <SectionHeader> does when it colours a heading for
 * a dark background, and what every section lede does. The result was
 * headings and body copy rendering at the inherited 14px with no error
 * anywhere — the classes were in the source, correct, and thrown away at
 * runtime. Tailwind's own text-sm/base/lg are unaffected because
 * tailwind-merge ships knowing them; only a custom scale hits this.
 *
 * Listing the names here fixes it. It is the one place that has to be updated
 * when a size is added to the @theme block, so the list is kept in the same
 * order as the tokens are declared there.
 */
const FONT_SIZES = [
  "display-xl",
  "display-l",
  "display-m",
  "display-s",
  "eyebrow",
  "copy-xs",
  "copy-sm",
  "copy",
  "copy-lg",
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: FONT_SIZES }] } },
});

/** Merge Tailwind classes so a caller's className can override a component's. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** A URL-safe slug from a product name. Stable, so it can be a permalink. */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
