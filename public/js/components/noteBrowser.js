import { el } from '../core/dom.js';
import { noteSkeletons } from './noteCard.js';
import { panel } from './results.js';

/**
 * A paginated, filterable list of note cards: skeleton on first load, "Load more" for the next 20,
 * and friendly empty / error states. Used by the Wall, My notes and the admin page.
 *   fetchPage(params) -> { items, nextCursor, total }
 *   renderCard(note)  -> <li>
 *   empty({ filtered }) -> a node shown when there is nothing to list
 */
export function createNoteBrowser({ list, meta, fetchPage, renderCard, empty, noun = 'notes' }) {
  let params = {};
  let cursor = null;
  let ul = null;
  let loading = false;
  let moreBtn = null;
  let run = 0; // a slow response for old filters must not overwrite newer results

  const isFiltered = () => Object.values(params).some((v) => v !== undefined && v !== '');

  function setMeta(total) {
    const n = ul ? ul.children.length : 0;
    if (!total) meta.textContent = '';
    else if (isFiltered()) meta.textContent = `${total.toLocaleString('en-US')} ${total === 1 ? noun.replace(/s$/, '') : noun} found${n < total ? `, showing ${n}` : ''}`;
    else meta.textContent = `Showing ${n} of ${total.toLocaleString('en-US')} ${noun}`;
  }

  function renderMore() {
    moreBtn?.parentElement?.remove();
    moreBtn = null;
    if (!cursor) return;
    const wrap = el('div', 'more');
    moreBtn = el('button', 'btn-quiet', `Load more ${noun}`);
    moreBtn.type = 'button';
    moreBtn.addEventListener('click', () => load({ more: true }));
    wrap.append(moreBtn);
    list.append(wrap);
  }

  async function load({ more = false } = {}) {
    if (loading && more) return;
    const mine = ++run;
    loading = true;
    if (!more) {
      cursor = null;
      ul = null;
      list.replaceChildren(noteSkeletons());
      meta.textContent = 'Loading…';
    } else if (moreBtn) {
      moreBtn.disabled = true;
      moreBtn.textContent = 'Loading…';
    }
    try {
      const page = await fetchPage({ ...params, before: more ? cursor : undefined });
      if (mine !== run) return;
      cursor = page.nextCursor;
      if (!more && !page.items.length) {
        list.replaceChildren(empty({ filtered: isFiltered() }));
        meta.textContent = '';
        return;
      }
      if (!ul) {
        ul = el('ul', 'ngrid');
        list.replaceChildren(ul);
      }
      page.items.forEach((n) => ul.append(renderCard(n)));
      setMeta(page.total);
      renderMore();
    } catch (err) {
      if (mine !== run) return;
      if (!more) {
        list.replaceChildren(
          panel({
            tone: 'err',
            iconName: 'alert',
            title: 'Could not load the notes.',
            message: err.status === 401 ? 'Please log in and try again.' : 'Check your internet connection and try again.',
            action: { label: 'Try again', onClick: () => load() },
          }),
        );
        meta.textContent = '';
      } else if (moreBtn) {
        moreBtn.disabled = false;
        moreBtn.textContent = 'Could not load. Try again';
      }
    } finally {
      if (mine === run) loading = false;
    }
  }

  return {
    /** Start over with new filters. */
    show(next) {
      params = next;
      return load();
    },
    refresh: () => load(),
  };
}
