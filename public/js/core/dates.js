export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));
// Leap-year lengths, so February 29 can be chosen.
export const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_START = MONTH_DAYS.reduce((acc, _n, i) => (acc.push(i ? acc[i - 1] + MONTH_DAYS[i - 1] : 0), acc), []);

export const daysIn = (m) => MONTH_DAYS[m - 1];
export const dayOfYear = (m, d) => MONTH_START[m - 1] + d - 1;
export const isValidDate = (m, d) => Number.isInteger(m) && Number.isInteger(d) && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(m);
export const label = ({ m, d }) => `${MONTHS[m - 1]} ${d}`;

export function today() {
  const now = new Date();
  return { m: now.getMonth() + 1, d: now.getDate() };
}

/** Move by whole days, wrapping around the year (Dec 31 -> Jan 1) using a leap year as the calendar. */
export function shift({ m, d }, delta) {
  const x = new Date(2024, m - 1, d + delta);
  return { m: x.getMonth() + 1, d: x.getDate() };
}

// URL form: "10-18"
export const toParam = ({ m, d }) => `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function fromParam(text) {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(text || '');
  if (!match) return null;
  const m = Number(match[1]);
  const d = Number(match[2]);
  return isValidDate(m, d) ? { m, d } : null;
}

export function fmtYear(y) {
  return y < 0 ? `${-y} BC` : String(y);
}
export function yearsAgo(y, now = new Date().getFullYear()) {
  const n = y < 0 ? now - y - 1 : now - y;
  return n === 0 ? 'this year' : `${n.toLocaleString('en-US')} years ago`;
}

/** "3 hours ago", "yesterday" — falls back to a plain date for anything older than a month. */
export function timeAgo(iso, now = Date.now()) {
  const secs = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(secs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(secs / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(secs / 86400), 'day');
  return new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}
