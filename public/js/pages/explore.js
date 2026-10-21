import { $, animateIn, debounce, el } from '../core/dom.js';
import { fromParam, label, today, toParam } from '../core/dates.js';
import { fetchDay } from '../api/history.js';
import { createDateControls } from '../components/dateControls.js';
import { createCategoryRail } from '../components/categoryRail.js';
import { buildEntries, errorPanel, skeleton } from '../components/results.js';

const TYPES = { events: 'Events', births: 'Births', deaths: 'Deaths', holidays: 'Holidays' };

const params = new URLSearchParams(location.search);
const state = {
  date: fromParam(params.get('date')) || today(),
  type: params.get('type') in TYPES ? params.get('type') : 'events',
  q: (params.get('q') || '').slice(0, 80),
  asc: true,
  data: null,
  token: 0, // lets a slow response be ignored once a newer date was requested
};

const results = $('results');
let dial = null;

/* ---------- URL + page chrome ---------- */

function syncUrl() {
  const next = new URLSearchParams({ date: toParam(state.date) });
  if (state.type !== 'events') next.set('type', state.type);
  if (state.q.trim()) next.set('q', state.q.trim());
  history.replaceState(null, '', `?${next}`);
}

function updateChrome() {
  const where = label(state.date);
  $('resHead').textContent = `${TYPES[state.type]} on ${where}`;
  document.title = `${TYPES[state.type]} on ${where} — On This Day`;
  rail.setPlaceholder(`Search ${state.type}…`);
  rail.setActive(state.type);
  rail.setSort({ asc: state.asc, visible: state.type !== 'holidays' });
  rail.setCounts(state.data);
}

/* ---------- rendering ---------- */

function render(animate = false) {
  if (!state.data) return;
  updateChrome();
  const { node, shown, total } = buildEntries({
    list: state.data[state.type] || [],
    type: state.type,
    q: state.q,
    asc: state.asc,
    date: state.date,
    onClearSearch: () => {
      state.q = '';
      rail.setQuery('');
      syncUrl();
      render();
      rail.focusSearch();
    },
  });
  const q = state.q.trim();
  $('resMeta').textContent = !total ? '0 entries' : q ? `${shown} of ${total} entries match “${q}”` : `${total} entries from Wikipedia`;
  results.replaceChildren(node);
  if (animate) animateIn(node);
}

async function load() {
  const token = ++state.token;
  state.data = null;
  syncUrl();
  updateChrome();
  $('resMeta').textContent = 'Fetching from Wikipedia…';
  results.replaceChildren(skeleton());
  try {
    const data = await fetchDay(state.date);
    if (token !== state.token) return;
    state.data = data;
    render(true);
  } catch {
    if (token !== state.token) return;
    $('resMeta').textContent = '';
    results.replaceChildren(errorPanel(load));
  }
}

function go(date) {
  state.date = date;
  dial?.setDate(date);
  load();
}

/* ---------- wiring ---------- */

const controls = createDateControls({ onCommit: go });

const rail = createCategoryRail({
  types: TYPES,
  onType(type) {
    if (type === state.type) return;
    state.type = type;
    syncUrl();
    if (state.data) render(true);
    else updateChrome();
  },
  onSearch: debounce((value) => {
    state.q = value;
    syncUrl();
    render();
  }, 120),
  onSort() {
    state.asc = !state.asc;
    render();
  },
});
rail.setQuery(state.q);

document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    controls.step(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    controls.step(1);
  } else if (e.key === '/') {
    e.preventDefault();
    rail.focusSearch();
  }
});

controls.set(state.date);
load();

/* ---------- 3D dial: loaded on its own so the page works even if WebGL or three.js is unavailable ---------- */

function dialFallback() {
  $('stage')?.remove();
  $('dialwrap').append(el('p', 'nogl', 'The 3D dial needs WebGL. Use the date controls below to pick a day.'));
}

import('../components/dial.js')
  .then(({ createDial }) => {
    dial = createDial({
      canvas: $('stage'),
      date: state.date,
      onScrub: (d) => controls.set(d), // while dragging: update the numbers only
      onCommit: (d) => {
        controls.set(d);
        go(d); // on release: fetch
      },
    });
  })
  .catch(dialFallback);
