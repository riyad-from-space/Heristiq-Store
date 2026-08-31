/**
 * Bangladeshi mobile numbers: 11 digits starting 01, with an operator digit of
 * 3-9. Accepts +880 / 880 prefixes and any spacing or dashes the user types.
 *
 * Shared by the client form (so the user is told before a round trip) and the
 * server action (which is what actually decides), so the two cannot drift.
 */
export function normalisePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/[\s\-()]/g, "");
  const local = digits.replace(/^(\+?880)/, "0");
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

export function isValidPhone(raw: string): boolean {
  return normalisePhone(raw) !== null;
}
