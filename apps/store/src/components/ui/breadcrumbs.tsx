import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * The trail above a page heading.
 *
 * Lifted verbatim out of the product page, where it was inline and hardcoded
 * to "Waist chains → /shop". That was true while waist chains were the only
 * thing sold and became a lie the moment there were five categories: a
 * bracelet's breadcrumb would have offered to take you back to waist chains.
 *
 * The last crumb is the current page and is deliberately NOT a link — a
 * breadcrumb that navigates to where you already are is a dead control, and
 * `aria-current="page"` is what tells a screen reader which one it is.
 *
 * Separators are aria-hidden. A screen reader announcing "Home slash Bracelets
 * slash Silver moon" reads the punctuation as a word; the list structure
 * already conveys the nesting.
 */
export type Crumb = {
  label: string;
  /** Omitted on the last crumb, which is the page you are on. */
  href?: string;
};

export function Breadcrumbs({
  trail,
  className,
}: {
  trail: Crumb[];
  className?: string;
}) {
  if (trail.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-stone text-xs", className)}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="hover:text-ink duration-quick transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                /* min-w-0 + truncate so a long product name shortens instead
                   of pushing the trail into a second line on a phone. */
                <span className="text-ink min-w-0 truncate" aria-current="page">
                  {crumb.label}
                </span>
              )}
              {!last && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
