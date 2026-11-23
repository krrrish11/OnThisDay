import { el } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { fmtLong, fmtShort } from '../core/dates.js';
import { photoUrl } from '../api/notes.js';

/** Photo box with a calm placeholder if the image fails. Alt text says whose note it belongs to. */
export function notePhoto(note, className = 'nphoto') {
  const box = el('div', className);
  const img = new Image();
  img.src = photoUrl(note.id);
  img.alt = `Photo from ${note.name || 'an anonymous visitor'}'s note about ${fmtLong(note.date)}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => box.replaceChildren(icon('image', 28)));
  box.append(img);
  return box;
}

export function visibilityBadge(note) {
  const b = el('span', 'badge-vis');
  b.append(icon('lock', 13), 'Private');
  return b;
}

/**
 * One note as a card. The whole card opens the note page through the text link (stretched with CSS),
 * so there is a single tab stop and a clear accessible name.
 *   showVisibility: show a "Private" badge (My notes)
 *   onDelete(note): when given, adds a two-step Delete button; it must return a promise
 */
export function noteCard(note, { showVisibility = false, onDelete, compact = false } = {}) {
  const li = el('li', `ncard${note.hasPhoto ? ' has-photo' : ''}${compact ? ' compact' : ''}`);
  if (note.hasPhoto) li.append(notePhoto(note));

  const body = el('div', 'ncard-body');
  const top = el('div', 'ncard-top');
  top.append(el('span', 'date-chip', fmtShort(note.date)));
  if (note.isPrivate && showVisibility) top.append(visibilityBadge(note));

  const text = el('p', 'ncard-text');
  const link = el('a', 'ncard-link', note.text);
  link.href = `/n/${note.id}`;
  text.append(link);

  const foot = el('footer', 'ncard-foot');
  foot.append(el('span', 'who', note.name || 'Anonymous'), el('span', 'nid', note.id));
  body.append(top, text, foot);
  li.append(body);

  if (onDelete) foot.append(deleteControl(note, onDelete, () => li.remove()));
  return li;
}

/** "Delete" -> "Really delete?" [Yes, delete] [Cancel]. Deleting is permanent, so it takes two deliberate clicks. */
export function deleteControl(note, onDelete, onDone) {
  const wrap = el('span', 'del');
  const ask = el('button', 'link-btn danger', 'Delete');
  ask.type = 'button';
  ask.setAttribute('aria-label', `Delete note ${note.id}`);

  const confirm = el('span', 'del-confirm');
  confirm.hidden = true;
  const yes = el('button', 'btn-danger', 'Yes, delete');
  yes.type = 'button';
  const no = el('button', 'link-btn', 'Cancel');
  no.type = 'button';
  const msg = el('span', 'del-msg');
  msg.setAttribute('role', 'status');
  confirm.append(yes, no);

  ask.addEventListener('click', () => {
    ask.hidden = true;
    confirm.hidden = false;
    yes.focus();
  });
  no.addEventListener('click', () => {
    confirm.hidden = true;
    ask.hidden = false;
    msg.textContent = '';
    ask.focus();
  });
  yes.addEventListener('click', async () => {
    yes.disabled = true;
    yes.textContent = 'Deleting…';
    try {
      await onDelete(note);
      onDone();
    } catch (err) {
      yes.disabled = false;
      yes.textContent = 'Yes, delete';
      msg.textContent = err.message || 'Could not delete. Try again.';
    }
  });

  wrap.append(ask, confirm, msg);
  return wrap;
}

export function noteSkeletons(n = 6) {
  const ul = el('ul', 'ngrid');
  ul.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) ul.append(el('li', 'ncard sk'));
  return ul;
}
