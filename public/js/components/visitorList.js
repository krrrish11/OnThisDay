import { $, el } from '../core/dom.js';
import { MONTH_ABBR, timeAgo, toParam } from '../core/dates.js';
import { listVisitors } from '../api/visitors.js';
import { panel } from './results.js';

function noteNode(v) {
  const li = el('li', 'note');
  li.append(el('blockquote', null, v.message));
  const foot = el('footer');
  foot.append(el('span', 'who', v.name));
  if (v.place) foot.append(el('span', null, v.place));
  if (v.favDate) {
    const a = el('a', 'date-chip', `${MONTH_ABBR[v.favDate.m - 1]} ${v.favDate.d}`);
    a.href = `/?date=${toParam(v.favDate)}`;
    a.title = 'See what happened on this date';
    foot.append(a);
  }
  const when = el('time', 'when', timeAgo(v.createdAt));
  when.dateTime = v.createdAt;
  when.title = new Date(v.createdAt).toLocaleString();
  foot.append(when);
  li.append(foot);
  return li;
}

/** The wall: first page, "Show more", and live additions after posting. */
export function createVisitorList() {
  const box = $('list');
  const meta = $('entriesMeta');
  let ul = null;
  let cursor = null;
  let total = 0;
  let loading = false;
  let moreBtn = null;

  function setTotal(n) {
    total = n;
    $('count').textContent = n.toLocaleString('en-US');
    $('countLabel').textContent = n === 1 ? 'reader has left a note.' : 'readers have left a note.';
  }

  function emptyState() {
    box.replaceChildren(panel({ iconName: 'inbox', title: 'No notes yet', message: 'Be the first to leave one. It takes a few seconds.' }));
  }

  function ensureList() {
    if (!ul) {
      ul = el('ul', 'notes');
      box.replaceChildren(ul);
    }
    return ul;
  }

  function renderMore() {
    moreBtn?.parentElement?.remove();
    moreBtn = null;
    if (!cursor) return;
    const wrap = el('div', 'more');
    moreBtn = el('button', 'btn-quiet', 'Show more notes');
    moreBtn.type = 'button';
    moreBtn.addEventListener('click', () => load());
    wrap.append(moreBtn);
    box.append(wrap);
  }

  function showSkeleton() {
    const sk = el('ul', 'notes');
    sk.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) sk.append(el('li', 'note sk'));
    box.replaceChildren(sk);
    meta.textContent = 'Loading notes…';
  }

  async function load({ first = false } = {}) {
    if (loading) return;
    loading = true;
    if (first) showSkeleton();
    else if (moreBtn) {
      moreBtn.disabled = true;
      moreBtn.textContent = 'Loading…';
    }
    try {
      const page = await listVisitors({ before: first ? undefined : cursor });
      setTotal(page.total);
      cursor = page.nextCursor;
      if (first) {
        ul = null;
        if (!page.items.length) {
          emptyState();
          meta.textContent = '';
          return;
        }
      }
      const list = ensureList();
      page.items.forEach((v) => list.append(noteNode(v)));
      meta.textContent = `Showing ${list.children.length} of ${total}`;
      renderMore();
    } catch {
      if (first) {
        box.replaceChildren(
          panel({
            tone: 'err',
            iconName: 'alert',
            title: 'Could not load the notes.',
            message: 'Check your internet connection and try again.',
            action: { label: 'Try again', onClick: () => load({ first: true }) },
          }),
        );
        meta.textContent = '';
      } else if (moreBtn) {
        moreBtn.disabled = false;
        moreBtn.textContent = 'Could not load. Try again';
      }
    } finally {
      loading = false;
    }
  }

  return {
    start: () => load({ first: true }),
    /** A note the visitor just posted goes straight to the top without refetching. */
    prepend(item) {
      const list = ensureList();
      list.prepend(noteNode(item));
      setTotal(total + 1);
      meta.textContent = `Showing ${list.children.length} of ${total}`;
    },
  };
}
