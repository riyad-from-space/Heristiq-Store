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

export function money(value: number | string | null | undefined, precise = false) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return precise ? bdtPrecise.format(n) : bdt.format(n);
}

export function num(value: number | string | null | undefined, digits = 0) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Dates are stored as plain `date` in Postgres — format without a timezone shift. */
export function date(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** N days before today in Asia/Dhaka, as YYYY-MM-DD. */
export function daysAgoDhaka(days: number) {
  const [y, m, d] = todayDhaka().split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
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
