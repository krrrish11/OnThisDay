import { el, highlight, safeImageUrl, safePageUrl } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { fmtYear, yearsAgo } from '../core/dates.js';

/* ---------- state panels ---------- */

export function panel({ tone = '', iconName, title, message, action }) {
  const box = el('div', `state ${tone}`.trim());
  const badge = el('div', 'badge');
  badge.append(icon(iconName, 26));
  box.append(badge, el('h3', null, title), el('p', null, message));
  if (action) {
    const b = el('button', 'btn', action.label);
    b.type = 'button';
    b.addEventListener('click', action.onClick);
    box.append(b);
  }
  return box;
}

export const errorPanel = (onRetry) =>
  panel({
    tone: 'err',
    iconName: 'alert',
    title: 'Unable to reach the historical archive.',
    message: 'Check your internet connection and try again.',
    action: { label: 'Try again', onClick: onRetry },
  });

export const emptyPanel = () =>
  panel({
    iconName: 'inbox',
    title: 'No historical records found',
    message: 'There are no recorded entries for this category on this date.',
  });

export const noMatchPanel = (q, onClear) =>
  panel({
    iconName: 'inbox',
    title: 'No matches',
    message: `Nothing here matches “${q}”. Try a different word, or clear the search.`,
    action: { label: 'Clear search', onClick: onClear },
  });

export function skeleton(rows = 4) {
  const ul = el('ul', 'tl');
  ul.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < rows; i++) {
    const g = el('li', 'grp');
    const yl = el('div', 'yl');
    yl.append(el('div', 'sk yr'));
    const st = el('div', 'stack');
    st.append(el('div', 'sk card'));
    g.append(yl, st);
    ul.append(g);
  }
  return ul;
}

/* ---------- entries ---------- */

function buildCard(item, type, q) {
  const card = el('article', 'card');
  const body = el('div');
  const text = el('p', 'txt');
  highlight(text, item.text || '', q);
  body.append(text);

  const pages = (item.pages || []).slice(0, 3);
  const refs = el('div', 'refs');
  for (const pg of pages) {
    const title = pg.normalizedtitle || pg.title;
    if (!title) continue;
    const a = el('a', null, title);
    a.href = safePageUrl(pg.url) || `https://en.wikipedia.org/wiki/${encodeURIComponent(pg.title || title)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    refs.append(a);
  }
  if (refs.children.length) body.append(refs);

  const thumb = el('div', 'thumb');
  const src = safeImageUrl(pages[0]?.thumbnail);
  const fallback = () => {
    thumb.replaceChildren(icon(type, 30));
    thumb.setAttribute('aria-hidden', 'true');
  };
  if (src) {
    const img = new Image();
    img.src = src;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = pages[0].normalizedtitle || pages[0].title || '';
    img.addEventListener('error', fallback);
    thumb.append(img);
  } else {
    fallback();
  }
  card.append(body, thumb);
  return card;
}

const matches = (it, q) =>
  (it.text || '').toLowerCase().includes(q) ||
  (it.pages || []).some((p) => (p.normalizedtitle || p.title || '').toLowerCase().includes(q)) ||
  String(it.year ?? '').includes(q);

/**
 * Build the results block. Returns { node, shown, total } — node is a panel when there is
 * nothing to show, so the caller just inserts it.
 */
export function buildEntries({ list, type, q, asc, onClearSearch }) {
  const total = list.length;
  if (!total) return { node: emptyPanel(), shown: 0, total };

  const needle = q.trim().toLowerCase();
  const items = needle ? list.filter((it) => matches(it, needle)) : list;
  if (!items.length) return { node: noMatchPanel(q.trim(), onClearSearch), shown: 0, total };

  if (type === 'holidays') {
    const grid = el('div', 'flat');
    items.forEach((it) => grid.append(buildCard(it, type, needle)));
    return { node: grid, shown: items.length, total };
  }

  const sorted = [...items].sort((a, b) => (asc ? (a.year ?? 0) - (b.year ?? 0) : (b.year ?? 0) - (a.year ?? 0)));
  const groups = new Map();
  for (const it of sorted) {
    if (!groups.has(it.year)) groups.set(it.year, []);
    groups.get(it.year).push(it);
  }
  const ul = el('ul', 'tl');
  groups.forEach((arr, year) => {
    const g = el('li', 'grp');
    const yl = el('div', 'yl');
    if (year !== undefined) yl.append(el('span', 'y', fmtYear(year)), el('span', 'ago', yearsAgo(year)));
    const stack = el('div', 'stack');
    arr.forEach((it) => stack.append(buildCard(it, type, needle)));
    g.append(yl, stack);
    ul.append(g);
  });
  return { node: ul, shown: items.length, total };
}
