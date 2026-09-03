/*
 * Money and dates. Copied in spirit from the ERP's src/lib/format.ts so the two
 * surfaces render the same number the same way — a customer seeing ৳1,250 on the
 * site and ৳1,250.00 on an invoice is a support ticket.
 */

const bdt = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

/**
 * ৳ only. There is no second currency in this business, so there is no
 * currency argument to get wrong.
 */
export function taka(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return bdt.format(n);
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

export function dateTimeDhaka(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
 * "2–4 days" style delivery window, rendered from a day count pair so the
 * dash is a real en-dash and the singular is not "1 days".
 */
export function dayRange(min: number, max: number) {
  if (min === max) return `${min} ${min === 1 ? "day" : "days"}`;
  return `${min}–${max} days`;
}
