"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, X } from "lucide-react";
import { finishes, motifs } from "@/config/site";
import { SORTS, type SortKey } from "@/lib/erp/types";
import { cn } from "@/lib/utils";

/*
 * Shop filters.
 *
 * Filters are LINKS, not JavaScript state. Three things fall out of that for
 * free: the filtered grid is a shareable URL, the back button works, and the
 * whole thing functions before any JS has loaded — which on a mid-range phone
 * on 3G is the first second or two of the visit.
 *
 * Sort is the one control that has to be a <select>: five options as five
 * links is a wall. It sits in a GET form so it also works without JS, with the
 * router taking over when JS is there to avoid a full reload.
 */
function buildHref(
  pathname: string,
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function FilterBar({ count }: { count: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const finish = params.get("finish");
  const motif = params.get("motif");
  const sort = (params.get("sort") ?? "featured") as SortKey;
  const active = [finish, motif].filter(Boolean).length;

  return (
    <div
      className={cn(
        "transition-opacity",
        pending && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-3">
        <FilterGroup label="Finish">
          <Chip href={buildHref(pathname, params, "finish", null)} active={!finish}>
            All
          </Chip>
          {Object.entries(finishes).map(([key, value]) => (
            <Chip
              key={key}
              href={buildHref(pathname, params, "finish", key)}
              active={finish === key}
            >
              <span
                aria-hidden
                className="border-line-strong mr-1.5 inline-block size-2.5 rounded-full border align-middle"
                style={{ background: value.swatch }}
              />
              {value.label}
            </Chip>
          ))}
        </FilterGroup>

        <span aria-hidden className="bg-line mx-1 hidden h-5 w-px sm:block" />

        <FilterGroup label="Motif">
          <Chip href={buildHref(pathname, params, "motif", null)} active={!motif}>
            All
          </Chip>
          {Object.entries(motifs).map(([key, value]) => (
            <Chip
              key={key}
              href={buildHref(pathname, params, "motif", key)}
              active={motif === key}
            >
              {value.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>

      <div className="border-line mt-6 flex items-center justify-between gap-4 border-t pt-4">
        <p className="text-ink-muted text-xs">
          {count} {count === 1 ? "piece" : "pieces"}
          {active > 0 && (
            <>
              {" · "}
              <Link
                href={pathname}
                className="decoration-line-strong underline underline-offset-4 hover:decoration-gold"
              >
                Clear filters
              </Link>
            </>
          )}
        </p>

        <form
          method="get"
          action={pathname}
          className="relative flex items-center"
          /* Keep the active filters when the sort changes — without these the
             GET form would submit sort alone and silently clear them. */
        >
          {finish && <input type="hidden" name="finish" value={finish} />}
          {motif && <input type="hidden" name="motif" value={motif} />}
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            onChange={(event) =>
              startTransition(() =>
                router.push(
                  buildHref(pathname, params, "sort", event.target.value),
                  { scroll: false },
                ),
              )
            }
            className="min-h-9 appearance-none bg-transparent pr-6 text-xs focus:outline-none"
          >
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            aria-hidden
            className="text-ink-muted pointer-events-none absolute right-0"
          />
          {/* The only thing JS removes is the need to press this. */}
          <noscript>
            <button type="submit" className="ml-2 text-xs underline">
              Apply
            </button>
          </noscript>
        </form>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  /*
   * The group label is visible on a phone too. It was sm:-only, which left two
   * rows each beginning with an unlabelled "All" chip and no way to tell which
   * was finish and which was motif — on the breakpoint that is 85% of traffic.
   */
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-eyebrow text-ink-faint uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center rounded-sm border px-3 text-xs transition-colors",
        active
          ? "border-ink bg-ink text-bone"
          : "border-line hover:border-line-strong hover:bg-shell",
      )}
    >
      {children}
    </Link>
  );
}

/** The "no results" state, with a way out that is not the back button. */
export function EmptyResults() {
  const pathname = usePathname();
  return (
    <div className="border-line flex flex-col items-center border border-dashed px-6 py-20 text-center">
      <X size={22} className="text-ink-faint" strokeWidth={1.5} />
      <p className="font-display mt-4 text-display-s">Nothing matches that</p>
      <p className="text-ink-muted mt-2 max-w-xs text-sm">
        The collection is still small. Clear the filters to see everything.
      </p>
      <Link
        href={pathname}
        className="text-eyebrow mt-6 uppercase underline decoration-1 underline-offset-8 hover:decoration-gold"
      >
        Show all pieces
      </Link>
    </div>
  );
}
