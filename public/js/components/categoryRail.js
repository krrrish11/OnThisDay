import { $, el } from '../core/dom.js';
import { icon } from '../core/icons.js';

/** Category tabs (with live counts), the search box and the sort toggle. */
export function createCategoryRail({ types, onType, onSearch, onSort }) {
  const tabs = $('tabs');
  const search = $('q');
  const sort = $('sort');

  for (const [key, label] of Object.entries(types)) {
    const b = el('button', 'tab');
    b.type = 'button';
    b.dataset.type = key;
    b.append(icon(key), el('span', null, label), el('span', 'n', '–'));
    tabs.append(b);
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) onType(b.dataset.type);
  });
  search.addEventListener('input', () => onSearch(search.value));
  sort.addEventListener('click', onSort);

  return {
    setActive(type) {
      tabs.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === type)));
    },
    /** data = the day's payload, or null while loading */
    setCounts(data) {
      tabs.querySelectorAll('.tab').forEach((b) => {
        b.querySelector('.n').textContent = data ? (data[b.dataset.type] || []).length : '–';
      });
    },
    setSort({ asc, visible }) {
      sort.hidden = !visible;
      sort.textContent = asc ? 'Oldest first' : 'Newest first';
      sort.setAttribute('aria-label', `Sorted ${asc ? 'oldest' : 'newest'} first. Change order.`);
    },
    setQuery(q) {
      search.value = q;
    },
    setPlaceholder(text) {
      search.placeholder = text;
    },
    focusSearch() {
      search.focus();
    },
  };
}
