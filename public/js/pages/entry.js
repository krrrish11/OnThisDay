import { $, el, animateIn, safeImageUrl, safePageUrl } from '../core/dom.js';
import { entryHref, fmtYear, fromParam, label, today, toParam, weekdayName, yearsAgo } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { fetchDay } from '../api/history.js';
import { fetchSummary } from '../api/summary.js';
import { panel } from '../components/results.js';

const KIND = { events: 'Event', births: 'Birth', deaths: 'Death', holidays: 'Holiday' };
const params = new URLSearchParams(location.search);
const date = fromParam(params.get('date'));
const type = params.get('type') in KIND ? params.get('type') : null;
const index = /^\d{1,4}$/.test(params.get('i') || '') ? Number(params.get('i')) : -1;
const yearParam = /^-?\d{1,4}$/.test(params.get('y') || '') ? Number(params.get('y')) : null;

const root = $('entry');
const exploreHref = (d, t) => `/?${new URLSearchParams({ date: toParam(d), ...(t !== 'events' ? { type: t } : {}) })}`;

function done() {
  root.removeAttribute('aria-busy');
}

function fail(title, message) {
  root.replaceChildren(
    Object.assign(panel({ tone: 'err', iconName: 'alert', title, message, action: { label: 'Back to Explore', onClick: () => (location.href = '/') } }), {
      className: 'state err e-state',
    }),
  );
  done();
}

function skeleton() {
  const wrap = el('div');
  wrap.setAttribute('aria-hidden', 'true');
  const head = el('div', 'e-head');
  head.append(el('div', 'sk', ''), el('div', 'sk'), el('div', 'sk'));
  head.children[0].style.cssText = 'width:110px;height:28px';
  head.children[1].style.cssText = 'width:min(360px,70%);height:90px';
  head.children[2].style.cssText = 'width:100%;height:64px';
  wrap.append(head);
  return wrap;
}

/* ---------- pieces ---------- */

function factsList(entry, list, total) {
  const dl = el('dl', 'facts');
  const row = (k, v) => {
    if (v == null || v === '') return;
    const d = el('div');
    d.append(el('dt', null, k), el('dd', null, v));
    dl.append(d);
  };
  const hasYear = Number.isInteger(entry.year);
  row('Category', KIND[type]);
  row('Date', label(date));
  if (hasYear) {
    row('Year', fmtYear(entry.year));
    row('Time since', yearsAgo(entry.year));
    row('Weekday', weekdayName(date, entry.year));
  } else {
    row('Recurs', 'Every year');
  }
  row(`${KIND[type]}s that day`, String(total));
  return dl;
}

function subjectCard(page) {
  const card = el('article', 'subject');
  const thumb = el('div', 'thumb');
  const body = el('div');
  const title = page.normalizedtitle || page.title;
  const wikiUrl = safePageUrl(page.url) || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`;

  const setThumb = (src, alt) => {
    const safe = safeImageUrl(src);
    if (!safe) return false;
    const img = new Image();
    img.src = safe;
    img.alt = alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => thumb.replaceChildren(icon(type, 34)));
    thumb.replaceChildren(img);
    return true;
  };
  if (!setThumb(page.thumbnail, title)) thumb.append(icon(type, 34));

  const h = el('h3', null, title);
  const desc = el('p', 'desc');
  const extract = el('p', 'extract sk sk-line');
  extract.setAttribute('aria-hidden', 'true');
  const read = el('a', 'read', 'Read the full article on Wikipedia ↗');
  read.href = wikiUrl;
  read.target = '_blank';
  read.rel = 'noopener';
  body.append(h, desc, extract, read);
  card.append(thumb, body);

  fetchSummary(page.title)
    .then((s) => {
      if (s.description) desc.textContent = s.description;
      else desc.remove();
      if (s.type === 'disambiguation') {
        extract.replaceWith(el('p', 'disamb', 'This title can refer to several things. The article lists them.'));
      } else if (s.extract) {
        extract.className = 'extract';
        extract.removeAttribute('aria-hidden');
        extract.textContent = s.extract;
      } else extract.remove();
      if (s.thumbnail && !thumb.querySelector('img')) setThumb(s.thumbnail, title);
      const url = safePageUrl(s.url);
      if (url) read.href = url;
    })
    .catch(() => {
      desc.remove();
      extract.remove(); // the card still works: title, picture and the Wikipedia link remain
    });
  return card;
}

function sameYear(data, entry) {
  if (!Number.isInteger(entry.year)) return null;
  const items = [];
  for (const t of Object.keys(KIND)) {
    (data[t] || []).forEach((it, i) => {
      if (it.year === entry.year && !(t === type && it === entry)) items.push({ it, t, i });
    });
  }
  if (!items.length) return null;
  const sec = el('section');
  sec.append(el('h2', null, `Also on ${label(date)}, ${fmtYear(entry.year)}`));
  const ul = el('ul', 'same');
  for (const { it, t, i } of items.slice(0, 6)) {
    const li = el('li');
    const a = el('a');
    a.href = entryHref(date, t, i, it.year);
    a.append(el('span', 'k', KIND[t]), el('span', 't', it.text));
    li.append(a);
    ul.append(li);
  }
  sec.append(ul);
  return sec;
}

function shareBlock(entry) {
  const box = el('div', 'share');
  const status = el('span', 'status');
  status.setAttribute('role', 'status');
  const copy = el('button', 'btn-quiet', 'Copy link');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      status.textContent = 'Link copied';
    } catch {
      status.textContent = 'Copy the address from your browser bar';
    }
    setTimeout(() => (status.textContent = ''), 2500);
  });
  box.append(copy);
  if (navigator.share) {
    const share = el('button', 'btn-quiet', 'Share');
    share.type = 'button';
    share.addEventListener('click', () => navigator.share({ title: document.title, text: entry.text.slice(0, 140), url: location.href }).catch(() => {}));
    box.append(share);
  }
  box.append(status);
  return box;
}

function pager(sorted, entry, data) {
  const pos = sorted.findIndex((s) => s.it === entry);
  const wrap = el('nav', 'pager');
  wrap.setAttribute('aria-label', 'More entries on this day');
  const make = (item, dir, cls) => {
    if (!item) {
      const n = el('div', `none ${cls}`);
      n.append(el('span', 'dir', dir === 'prev' ? '← Earliest entry' : 'Latest entry →'));
      return n;
    }
    const a = el('a', cls);
    a.href = entryHref(date, type, item.i, item.it.year);
    const when = Number.isInteger(item.it.year) ? ` · ${fmtYear(item.it.year)}` : '';
    a.append(el('span', 'dir', dir === 'prev' ? `← Previous${when}` : `Next${when} →`), el('span', 't', item.it.text));
    return a;
  };
  wrap.append(make(sorted[pos - 1], 'prev', 'prev'), make(sorted[pos + 1], 'next', 'next'));
  return { wrap, prev: sorted[pos - 1], next: sorted[pos + 1] };
}

/* ---------- page ---------- */

function render(data, found) {
  const { entry, i } = found;
  const list = data[type];
  // Same order as Explore's default (oldest first); holidays keep Wikipedia's order.
  const sorted = list.map((it, idx) => ({ it, i: idx }));
  if (type !== 'holidays') sorted.sort((a, b) => (a.it.year ?? 0) - (b.it.year ?? 0) || a.i - b.i);

  const hasYear = Number.isInteger(entry.year);
  const frag = el('div');

  const head = el('header', 'e-head');
  const kind = el('span', 'e-kind');
  kind.append(icon(type, 16), `${KIND[type]} · ${label(date)}`);
  head.append(kind);
  if (hasYear) {
    const yr = el('p', 'e-year');
    yr.append(el('span', 'y', fmtYear(entry.year)), el('span', 'ago', yearsAgo(entry.year)));
    head.append(yr);
  }
  const text = el('h1', 'e-text', entry.text);
  head.append(text);

  const grid = el('div', 'e-grid');
  const main = el('div', 'e-main');
  const side = el('aside', 'e-side');
  side.setAttribute('aria-label', 'Facts about this entry');

  const pages = entry.pages || [];
  const subjects = el('section');
  if (pages.length) {
    subjects.append(el('h2', null, pages.length > 1 ? 'People, places and things mentioned' : 'Subject'));
    const wrap = el('div', 'subjects');
    pages.forEach((p) => wrap.append(subjectCard(p)));
    subjects.append(wrap);
    main.append(subjects);
  } else {
    subjects.append(el('h2', null, 'Subject'), el('p', null, 'Wikipedia lists no linked articles for this entry.'));
    main.append(subjects);
  }

  side.append(factsList(entry, list, list.length));
  const related = sameYear(data, entry);
  if (related) side.append(related);
  side.append(shareBlock(entry));
  grid.append(main, side);

  const nav = pager(sorted, entry, data);
  const attrib = el('p', 'attrib');
  attrib.append('Entry and summaries from ');
  const wl = el('a', null, 'Wikipedia');
  wl.href = 'https://en.wikipedia.org/';
  wl.target = '_blank';
  wl.rel = 'noopener';
  attrib.append(wl, ', available under ');
  const cc = el('a', null, 'CC BY-SA 4.0');
  cc.href = 'https://creativecommons.org/licenses/by-sa/4.0/';
  cc.target = '_blank';
  cc.rel = 'noopener';
  attrib.append(cc, '.');

  frag.append(head, grid, nav.wrap, attrib);
  root.replaceChildren(frag);
  done();
  animateIn(frag);

  const back = $('backLink');
  back.href = exploreHref(date, type);
  back.textContent = `← Back to ${KIND[type]}s on ${label(date)}`;
  const short = entry.text.length > 70 ? `${entry.text.slice(0, 67)}…` : entry.text;
  document.title = `${hasYear ? `${fmtYear(entry.year)}: ` : ''}${short} — On This Day`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = entry.text.slice(0, 200);

  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input,select,textarea')) return;
    const to = e.key === 'ArrowLeft' ? nav.prev : e.key === 'ArrowRight' ? nav.next : null;
    if (to) location.href = entryHref(date, type, to.i, to.it.year);
  });
}

async function load() {
  if (!date || !type || index < 0) return fail('That link is incomplete', 'Open an entry from the Explore page and it will land here.');
  root.replaceChildren(skeleton());
  let data;
  try {
    data = await fetchDay(date);
  } catch {
    root.replaceChildren();
    return fail('Unable to reach the historical archive.', 'Check your internet connection and try again.');
  }
  const list = data[type] || [];
  let i = index;
  if (!(list[i] && (yearParam === null || list[i].year === yearParam))) {
    // Wikipedia reshuffled the day since the link was made: fall back to the same year.
    i = yearParam === null ? -1 : list.findIndex((it) => it.year === yearParam);
  }
  if (i < 0) return fail('That entry is no longer listed', `Wikipedia's list for ${label(date)} has changed. Try the Explore page.`);
  render(data, { entry: list[i], i });
}

load();
