/*
 * Money and dates, for both apps.
 *
 * Read the note on the two money formatters before using either.
 *
 * This file is deliberately a UNION of what the storefront and the ERP each
 * had, with every function keeping the exact behaviour it already had. Merging
 * the two repos was a structural change and nothing about what either app
 * renders was allowed to move, so `money` and `taka` both live here rather than
 * one being quietly replaced by the other.
 */

const bdt = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

const bdtPrecise = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/*
 * ---------------------------------------------------------------------------
 * TWO money formatters, on purpose — for now.
 *
 * `money` is the ERP's. It handles amounts a ledger produces: sub-taka costs
 * from weighted-average costing, and negative rounding that came out as the
 * nonsense "-৳0".
 *
 * `taka` is the storefront's. It only ever renders a retail price, a delivery
 * fee or an order total, all of which are whole taka by construction.
 *
 * They agree on every value the storefront can produce and differ below one
 * taka, which the storefront never has. Collapsing them would be a rendering
 * change in one app or the other, so they stay separate until someone decides
 * which. The names are the honest signal: `money` for ledger figures, `taka`
 * for prices.
 * ---------------------------------------------------------------------------
 */

/** Ledger money. Shows paisa below one taka and never renders "-৳0". */
export function money(
  value: number | string | null | undefined,
  precise = false,
) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  if (precise) return bdtPrecise.format(n);

  if (n === 0) return bdt.format(0);
  if (Math.abs(n) < 1) return bdtPrecise.format(n);

  const rounded = bdt.format(n);
  return rounded === bdt.format(-0) && n < 0 ? bdtPrecise.format(n) : rounded;
}

/**
 * Retail money. ৳ only — there is no second currency in this business, so
 * there is no currency argument to get wrong.
 */
export function taka(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return bdt.format(n);
}

export function num(value: number | string | null | undefined, digits = 0) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Today in Asia/Dhaka as YYYY-MM-DD — the business day, not the server's. */
export function todayDhaka() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * A plain Postgres `date`, formatted without a timezone shift.
 *
 * Not the same job as `dateDhaka` below: this takes a YYYY-MM-DD string that is
 * already a calendar date and must not be reinterpreted as an instant, because
 * new Date("2026-09-04") is midnight UTC and prints as the 3rd in Dhaka.
 */
export function date(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** A timestamp, in Dhaka. Both apps' old `dateTime`/`dateTimeDhaka`. */
export function dateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The storefront's name for it. Same function; both names kept. */
export const dateTimeDhaka = dateTime;

/** A timestamp rendered as a long date — "4 Sept 2026" — in Dhaka. */
export function dateDhaka(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The first day of the month after the given YYYY-MM-DD, as YYYY-MM-DD.
 * Used as an exclusive upper bound so month windows do not need a day count —
 * building "-31" by hand is not a valid date in a 30-day month.
 */
export function firstOfNextMonth(day: string) {
  const [y, m] = day.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** N days before today in Asia/Dhaka, as YYYY-MM-DD. */
export function daysAgoDhaka(days: number) {
  const [y, m, d] = todayDhaka().split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * "2–4 days" style delivery window, rendered from a day count pair so the
 * dash is a real en-dash and the singular is not "1 days".
 */
export function dayRange(min: number, max: number) {
  if (min === max) return `${min} ${min === 1 ? "day" : "days"}`;
  return `${min}–${max} days`;
}
