import { $, animateIn, el } from '../core/dom.js';
import { dateAgo, fmtLong } from '../core/dates.js';
import { deleteNote, getNote } from '../api/notes.js';
import { loadSession } from '../core/session.js';
import { forgetDeleteKey, getDeleteKey } from '../core/deleteKeys.js';
import { copyText } from '../core/forms.js';
import { deleteControl, notePhoto, visibilityBadge } from '../components/noteCard.js';
import { panel } from '../components/results.js';

const root = $('note');
const id = (location.pathname.split('/')[2] || '').toUpperCase();

function done() {
  root.removeAttribute('aria-busy');
}

function notFound(loggedIn) {
  root.replaceChildren(
    panel({
      iconName: 'lock',
      title: 'No note here',
      message: loggedIn
        ? 'This note does not exist, or it is private and belongs to someone else.'
        : 'This note does not exist, or it is private. If it is yours, log in to open it.',
      action: loggedIn ? { label: 'Browse the wall', href: '/wall' } : { label: 'Log in', href: `/login?next=${encodeURIComponent(location.pathname)}` },
    }),
  );
  done();
}

function render(note) {
  const art = el('article', 'npage');
  if (note.hasPhoto) art.append(notePhoto(note, 'npage-photo'));

  const head = el('header', 'npage-head');
  head.append(el('h1', 'npage-date', fmtLong(note.date)), el('p', 'npage-ago', dateAgo(note.date)));
  if (note.isPrivate) head.append(visibilityBadge(note));
  art.append(head, el('div', 'npage-text', note.text));

  const by = el('p', 'npage-by');
  by.append(`— ${note.name || 'Anonymous'}`, el('span', 'nid', note.id));
  art.append(by);

  const actions = el('div', 'npage-actions');
  const copy = el('button', 'btn', 'Copy link');
  copy.type = 'button';
  const msg = el('span', 'copied');
  msg.setAttribute('role', 'status');
  copy.addEventListener('click', async () => {
    msg.textContent = (await copyText(location.href)) ? 'Link copied' : 'Copy the address from your browser bar';
  });
  const hist = el('a', 'btn-quiet', `What happened in history on ${fmtLong(note.date).replace(/ \d{4}$/, '')}`);
  hist.href = `/?date=${String(note.month).padStart(2, '0')}-${String(note.day).padStart(2, '0')}`;
  actions.append(copy, hist, msg);

  // Owner (signed in) or the browser that holds the guest's delete key.
  const key = getDeleteKey(note.id);
  if (note.mine || key) {
    actions.append(
      deleteControl(
        note,
        async (n) => {
          await deleteNote(n.id, note.mine ? undefined : key);
          forgetDeleteKey(n.id);
        },
        () => (location.href = '/wall'),
      ),
    );
  }
  art.append(actions);

  root.replaceChildren(art);
  done();
  animateIn(art);
}

async function load() {
  root.replaceChildren(el('div', 'sk npage-sk'));
  const [session, result] = await Promise.all([loadSession(), getNote(id).then((r) => ({ ok: r.item }), (e) => ({ err: e }))]);
  if (result.ok) return render(result.ok);
  if (result.err.status === 404) return notFound(Boolean(session.user));
  root.replaceChildren(
    panel({ tone: 'err', iconName: 'alert', title: 'Could not load this note.', message: 'Check your internet connection and try again.', action: { label: 'Try again', onClick: load } }),
  );
  done();
}

load();
