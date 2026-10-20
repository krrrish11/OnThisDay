import { $, prefersReducedMotion } from '../core/dom.js';
import { MONTHS, MONTH_ABBR, daysIn, shift, today } from '../core/dates.js';

/**
 * The month/day menus, previous/next/today buttons, and every place the chosen date is shown
 * (big hero number, mini rail control). `onCommit(date)` fires when the user settles on a date.
 */
export function createDateControls({ onCommit }) {
  const monthSel = $('month');
  const daySel = $('day');

  MONTHS.forEach((name, i) => monthSel.append(new Option(name, i + 1)));

  function fillDays(m) {
    const keep = Number(daySel.value) || 1;
    const n = daysIn(m);
    daySel.replaceChildren();
    for (let d = 1; d <= n; d++) daySel.append(new Option(String(d).padStart(2, '0'), d));
    daySel.value = Math.min(keep, n);
  }

  const get = () => ({ m: Number(monthSel.value), d: Number(daySel.value) });

  function show({ m, d }) {
    const num = $('dnum');
    const changed = num.textContent !== String(d);
    $('mname').textContent = MONTHS[m - 1];
    num.textContent = d;
    $('miniDate').textContent = `${MONTH_ABBR[m - 1]} ${d}`;
    if (changed && !prefersReducedMotion() && num.animate) {
      num.animate([{ opacity: 0.2, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], {
        duration: 380,
        easing: 'cubic-bezier(.22,.8,.3,1)',
      });
    }
  }

  /** Programmatic update (no commit). */
  function set({ m, d }) {
    monthSel.value = m;
    fillDays(m);
    daySel.value = Math.min(d, daysIn(m));
    show(get());
  }

  const commit = () => {
    show(get());
    onCommit(get());
  };
  const step = (delta) => {
    set(shift(get(), delta));
    onCommit(get());
  };

  monthSel.addEventListener('change', () => {
    fillDays(Number(monthSel.value));
    commit();
  });
  daySel.addEventListener('change', commit);
  for (const id of ['prev', 'miniPrev']) $(id).addEventListener('click', () => step(-1));
  for (const id of ['next', 'miniNext']) $(id).addEventListener('click', () => step(1));
  $('today').addEventListener('click', () => {
    set(today());
    onCommit(get());
  });

  return { get, set, step };
}
