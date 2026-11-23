import { $, animateIn, el } from '../core/dom.js';
import { label, yearsAgoLabel } from '../core/dates.js';
import { onThisDay } from '../api/notes.js';
import { noteCard } from './noteCard.js';
import { panel } from './results.js';

const pad = (n) => String(n).padStart(2, '0');

/**
 * "From the wall": notes people pinned to this day and month in any year, grouped by how long ago.
 * Lives on the Explore page and follows the date chosen on the dial.
 */
export function createMemories() {
  const head = $('memHead');
  const body = $('memBody');
  const addLink = $('memAdd');
  let run = 0;

  function empty(date) {
    const box = el('div', 'state');
    const badge = el('div', 'badge');
    badge.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.6-6-10.5a6 6 0 1112 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/></svg>';
    const cta = el('a', 'btn', `Pin a memory for ${label(date)}`);
    cta.href = addHref(date);
    box.append(badge, el('h3', null, 'No memories here yet'), el('p', null, `Nobody has pinned a note to ${label(date)}. You could be the first: a few words and a photo are enough.`), cta);
    return box;
  }

  const addHref = (date) => `/add?date=${new Date().getFullYear()}-${pad(date.m)}-${pad(date.d)}`;

  function skeleton() {
    const row = el('div', 'mem-row');
    row.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) row.append(el('div', 'ncard sk compact'));
    return row;
  }

  async function show(date) {
    const mine = ++run;
    head.textContent = `From the wall on ${label(date)}`;
    addLink.href = addHref(date);
    body.replaceChildren(skeleton());
    try {
      const data = await onThisDay({ month: date.m, day: date.d });
      if (mine !== run) return;
      if (!data.groups.length) {
        body.replaceChildren(empty(date));
        return;
      }
      const frag = el('div', 'mem-groups');
      for (const g of data.groups) {
        const sec = el('section', 'mem-group');
        const h = el('h3');
        h.append(yearsAgoLabel(g.year), ' ', el('span', 'mem-year', String(g.year)));
        const ul = el('ul', 'mem-row');
        g.items.forEach((n) => ul.append(noteCard(n, { showVisibility: true, compact: true })));
        sec.append(h, ul);
        frag.append(sec);
      }
      if (data.total > data.shown) {
        const more = el('a', 'btn-quiet', `See all ${data.total} on the wall`);
        more.href = `/wall?month=${date.m}&day=${date.d}`;
        frag.append(el('div', 'more', null));
        frag.lastChild.append(more);
      }
      body.replaceChildren(frag);
      animateIn(frag);
    } catch {
      if (mine !== run) return;
      body.replaceChildren(
        panel({ tone: 'err', iconName: 'alert', title: 'Could not load memories.', message: 'The history below still works. Try again in a moment.', action: { label: 'Try again', onClick: () => show(date) } }),
      );
    }
  }

  return { show };
}
