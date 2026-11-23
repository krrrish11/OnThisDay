import { $, debounce } from '../core/dom.js';
import { MONTHS, daysIn } from '../core/dates.js';

/**
 * Search box + month/day/year filter. Reads its starting values from the URL so a filtered wall can be shared,
 * and calls onChange({ q, month, day, year }) whenever something changes.
 */
export function createFilterBar({ onChange, withDate = true }) {
  const q = $('q');
  const clear = $('clearFilters');
  const month = withDate ? $('fMonth') : null;
  const day = withDate ? $('fDay') : null;
  const year = withDate ? $('fYear') : null;

  if (withDate) {
    month.append(new Option('Any month', ''));
    MONTHS.forEach((name, i) => month.append(new Option(name, i + 1)));
    fillDays();
  }

  function fillDays() {
    const m = Number(month.value);
    const keep = day.value;
    day.replaceChildren(new Option(m ? 'Any day' : 'Day', ''));
    day.disabled = !m;
    if (!m) return;
    for (let d = 1; d <= daysIn(m); d++) day.append(new Option(String(d), d));
    if (keep && Number(keep) <= daysIn(m)) day.value = keep;
  }

  function read() {
    const f = { q: q.value.trim() };
    if (withDate) {
      const m = Number(month.value);
      const d = Number(day.value);
      if (m && d) {
        f.month = m;
        f.day = d;
      }
      const y = Number(year.value);
      if (Number.isInteger(y) && y >= 1900 && y <= 2200) f.year = y;
    }
    return f;
  }

  function sync() {
    const f = read();
    const active = Boolean(f.q || f.month || f.year);
    if (clear) clear.hidden = !active;
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) next.set(k, v);
    history.replaceState(null, '', next.size ? `?${next}` : location.pathname);
    onChange(f);
  }

  const soon = debounce(sync, 250);
  q.addEventListener('input', soon);
  $('filters').addEventListener('submit', (e) => {
    e.preventDefault();
    sync();
  });
  if (withDate) {
    month.addEventListener('change', () => {
      fillDays();
      if (!month.value || day.value) sync(); // wait for a day before filtering by date
    });
    day.addEventListener('change', sync);
    year.addEventListener('input', soon);
  }
  clear?.addEventListener('click', () => {
    q.value = '';
    if (withDate) {
      month.value = '';
      year.value = '';
      fillDays();
    }
    sync();
    q.focus();
  });

  // Start from the URL.
  const p = new URLSearchParams(location.search);
  q.value = (p.get('q') || '').slice(0, 80);
  if (withDate) {
    const m = Number(p.get('month'));
    if (m >= 1 && m <= 12) {
      month.value = m;
      fillDays();
      const d = Number(p.get('day'));
      if (d >= 1 && d <= daysIn(m)) day.value = d;
    }
    const y = Number(p.get('year'));
    if (y >= 1900 && y <= 2200) year.value = y;
  }
  if (clear) clear.hidden = !(q.value || (withDate && (month.value || year.value)));

  return { read, focus: () => q.focus() };
}
