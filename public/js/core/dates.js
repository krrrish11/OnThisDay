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

/**
 * Weekday name for a month/day in a given year, or null when it can't be trusted:
 * before 1583 Wikipedia's dates are Julian, so a Gregorian weekday would be wrong.
 */
export function weekdayName({ m, d }, year) {
  if (!Number.isInteger(year) || year < 1583) return null;
  const t = new Date(Date.UTC(2000, m - 1, d));
  t.setUTCFullYear(year);
  if (t.getUTCMonth() !== m - 1) return null; // Feb 29 in a non-leap year
  return t.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

/** Link to an entry's details page. `index` is its position in the API list for that date and type. */
export function entryHref(date, type, index, year) {
  const p = new URLSearchParams({ date: toParam(date), type, i: String(index) });
  if (Number.isInteger(year)) p.set('y', String(year));
  return `/entry?${p}`;
}

/* ---------- note dates (full YYYY-MM-DD, as stored on notes) ---------- */

const pad = (n) => String(n).padStart(2, '0');

/** Today in the reader's own time zone, as "YYYY-MM-DD" (what <input type="date"> wants). */
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2024-03-12" -> "12 March 2024". Parsed by hand so the reader's time zone cannot shift the day. */
export function fmtLong(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1])}` : '';
}
export function fmtShort(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTH_ABBR[Number(m[2]) - 1]} ${Number(m[1])}` : '';
}

/** How long ago a calendar date was: "today", "3 days ago", "5 months ago", "2 years ago". */
export function dateAgo(iso, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, mo - 1, d)) / 86_400_000);
  if (days < 0) return 'upcoming';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
  if (now.getDate() < d) months -= 1;
  if (months < 12) return `${Math.max(months, 1)} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/** "This year", "1 year ago", "5 years ago" for a memory group on the Explore page. */
export function yearsAgoLabel(year, now = new Date().getFullYear()) {
  const n = now - year;
  if (n === 0) return 'This year';
  if (n < 0) return 'Upcoming';
  return n === 1 ? '1 year ago' : `${n} years ago`;
}
