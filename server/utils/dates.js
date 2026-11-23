// Leap-year lengths so Feb 29 is a valid "on this day" date.
export const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isValidMonthDay(m, d) {
  return Number.isInteger(m) && Number.isInteger(d) && m >= 1 && m <= 12 && d >= 1 && d <= MONTH_DAYS[m - 1];
}

/** A real calendar date (rejects Feb 30, Apr 31, and Feb 29 in non-leap years). */
export function isRealDate(y, m, d) {
  if (![y, m, d].every(Number.isInteger) || m < 1 || m > 12 || d < 1) return false;
  const t = new Date(Date.UTC(2000, m - 1, d));
  t.setUTCFullYear(y);
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
