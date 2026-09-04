/**
 * Bangladeshi mobile numbers: 11 digits starting 01, with an operator digit of
 * 3-9. Accepts +880 / 880 prefixes and any spacing or dashes anyone types.
 *
 * This has to be ONE implementation, and the reason is concrete: the ERP
 * searches on phone numbers the storefront wrote, the database enforces the
 * same rule in `normalise_bd_phone()` (migration 0015), and a number stored two
 * ways never matches. Both apps' src/lib/phone.ts now re-export this, so the
 * two copies that used to exist — and were kept identical by hand and a comment
 * asking nicely — cannot drift again.
 */
export function normalisePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/[\s\-()]/g, "");
  const local = digits.replace(/^(\+?880)/, "0");
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

export function isValidPhone(raw: string): boolean {
  return normalisePhone(raw) !== null;
}

/** 01712-345678 — how a Bangladeshi reads their own number back. */
export function displayPhone(raw: string): string {
  const local = normalisePhone(raw);
  if (!local) return raw;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

/** wa.me wants 8801712345678: no plus, no leading zero. */
export function whatsappNumber(raw: string): string | null {
  const local = normalisePhone(raw);
  return local ? `880${local.slice(1)}` : null;
}
