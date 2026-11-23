import { $, el } from '../core/dom.js';
import { MONTHS, fmtLong, todayIso } from '../core/dates.js';
import { createNote } from '../api/notes.js';
import { loadSession } from '../core/session.js';
import { saveDeleteKey } from '../core/deleteKeys.js';
import { compressImage, PhotoError } from '../core/image.js';
import { copyText, setError, showStatus } from '../core/forms.js';

const form = $('noteForm');
const text = $('text');
const dateInput = $('date');
const status = $('formStatus');
const saveBtn = $('save');
const fields = ['text', 'date', 'name', 'photo'];
// Mirrors the server rules for instant feedback; the server stays the authority.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|in|ru|cn|xyz|info|biz|link|top|shop|site|online)\b)/i;

let session = { user: null, accountsEnabled: false };
let photo = null; // { dataUrl, bytes, width, height } once compressed
let busy = false; // compressing or saving

/* ---------- date: defaults to today, or the date a link asked for ---------- */
const today = todayIso();
dateInput.max = today;
const asked = new URLSearchParams(location.search).get('date');
dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(asked || '') && asked >= '1900-01-01' && asked <= today ? asked : today;

/* ---------- text counter ---------- */
text.addEventListener('input', () => {
  $('text-count').textContent = `${[...text.value].length} / 2000`;
});

/* ---------- photo ---------- */
function setPhotoBusy(on) {
  busy = on;
  saveBtn.disabled = on;
  $('drop').classList.toggle('is-busy', on);
}

function showPreview(result, file) {
  photo = result;
  $('previewImg').src = URL.createObjectURL(result.blob);
  $('previewInfo').textContent = `${file.name} · shrunk to ${result.width}×${result.height}, ${Math.round(result.bytes / 1024)} KB`;
  $('preview').hidden = false;
  $('drop').hidden = true;
}

function clearPhoto() {
  const url = $('previewImg').src;
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  photo = null;
  $('photo').value = '';
  $('previewImg').removeAttribute('src');
  $('preview').hidden = true;
  $('drop').hidden = false;
  setError('photo', '');
}

$('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setError('photo', '');
  setPhotoBusy(true);
  $('drop').querySelector('span').textContent = 'Shrinking photo…';
  try {
    showPreview(await compressImage(file), file);
  } catch (err) {
    clearPhoto();
    setError('photo', err instanceof PhotoError ? err.message : 'This photo could not be processed.');
  } finally {
    $('drop').querySelector('span').textContent = 'Choose a photo';
    setPhotoBusy(false);
  }
});
$('removePhoto').addEventListener('click', () => {
  clearPhoto();
  $('photo').focus();
});

/* ---------- Public / Private ---------- */
const hint = $('segHint');
const radios = form.querySelectorAll('input[name=visibility]');
const isPrivate = () => form.elements.visibility.value === 'private';

function setHint(kind) {
  hint.replaceChildren();
  if (kind === 'public') hint.append('Public notes appear on the wall and in search. Links are not allowed in them.');
  else if (kind === 'private') hint.append(`Only you can see this note, when you are logged in${session.user ? ` as ${session.user.username}` : ''}. Links are fine here.`);
  else if (kind === 'login') {
    hint.append('Private notes need an account. ');
    const a = el('a', null, 'Log in or create one');
    a.href = '/login?next=/add';
    hint.append(a, ', then come back. Your note stays public until then.');
  } else hint.append('Private notes need accounts, which are not set up on this server yet.');
}

radios.forEach((r) =>
  r.addEventListener('change', () => {
    if (isPrivate() && !session.user) {
      form.elements.visibility.value = 'public';
      setHint(session.accountsEnabled ? 'login' : 'off');
      return;
    }
    setHint(isPrivate() ? 'private' : 'public');
  }),
);

loadSession().then((s) => {
  session = s;
});

/* ---------- submit ---------- */
function validate(v) {
  const errors = {};
  const n = [...v.text.trim()].length;
  if (n < 3) errors.text = 'Write at least 3 characters.';
  else if (n > 2000) errors.text = 'Keep your note under 2000 characters.';
  else if (!v.isPrivate && LINK.test(v.text)) errors.text = 'Links are not allowed in public notes. Make it private, or remove the link.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || v.date < '1900-01-01' || v.date > today) errors.date = 'Choose a date from 1900 up to today.';
  if ([...v.name.trim()].length > 40) errors.name = 'Keep the name under 40 characters.';
  else if (v.name && !v.isPrivate && LINK.test(v.name)) errors.name = 'Links are not allowed in names.';
  return errors;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  fields.forEach((f) => setError(f, ''));
  showStatus(status, '', '');
  const data = new FormData(form);
  const values = { text: text.value, date: dateInput.value, name: String(data.get('name') || ''), isPrivate: isPrivate() };
  const errors = validate(values);
  if (Object.keys(errors).length) {
    Object.entries(errors).forEach(([f, t]) => setError(f, t));
    showStatus(status, 'bad', 'Please fix the highlighted fields.');
    $(Object.keys(errors)[0])?.focus();
    return;
  }

  setPhotoBusy(true);
  saveBtn.textContent = 'Saving…';
  try {
    const res = await createNote({ ...values, photo: photo?.dataUrl, website: String(data.get('website') || '') });
    done(res);
  } catch (err) {
    if (err.errors) {
      Object.entries(err.errors).forEach(([f, t]) => setError(f, t));
      $(Object.keys(err.errors)[0])?.focus();
    }
    if (err.status === 401) setHint(session.accountsEnabled ? 'login' : 'off');
    showStatus(status, 'bad', err.errors ? 'Please fix the highlighted fields.' : err.message || 'Could not save your note. Please try again.');
  } finally {
    setPhotoBusy(false);
    saveBtn.textContent = 'Save note';
  }
});

/* ---------- success ---------- */
function done({ item, deleteKey }) {
  const link = `${location.origin}/n/${item.id}`;
  const keyStored = deleteKey ? saveDeleteKey(item.id, deleteKey) : false;

  const view = $('doneView');
  view.replaceChildren();

  const tick = el('div', 'tick');
  tick.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const h = el('h2', null, item.isPrivate ? 'Saved, just for you' : 'Pinned to the wall');
  h.tabIndex = -1;
  view.append(tick, h, el('p', 'add-sub', `Your note for ${fmtLong(item.date)} is saved. Its ID is:`), el('p', 'big-id', item.id));

  const row = el('div', 'copy-row');
  const input = el('input', 'input');
  input.readOnly = true;
  input.value = link;
  input.setAttribute('aria-label', 'Link to your note');
  input.addEventListener('focus', () => input.select());
  const copy = el('button', 'btn', 'Copy link');
  copy.type = 'button';
  const copied = el('span', 'copied');
  copied.setAttribute('role', 'status');
  copy.addEventListener('click', async () => {
    const ok = await copyText(link);
    copied.textContent = ok ? 'Link copied' : 'Press Ctrl+C to copy';
    if (!ok) input.select();
  });
  row.append(input, copy);
  view.append(row, copied);

  if (item.isPrivate) {
    view.append(el('p', 'note-line', 'Only you can open this link while logged in. Find it any time under My notes.'));
  } else if (deleteKey) {
    const box = el('div', 'key-box');
    box.append(el('strong', null, keyStored ? 'Your delete key is saved in this browser.' : 'Save your delete key now.'));
    box.append(
      el('p', null, keyStored
        ? 'Only this browser can delete the note. If you clear your browser data you lose the key, so you may want a copy. Logging in next time avoids this.'
        : 'This browser could not store it, and it is shown only once. Without it, nobody can delete this note.'),
    );
    const keyRow = el('div', 'copy-row');
    const keyInput = el('input', 'input mono');
    keyInput.readOnly = true;
    keyInput.value = deleteKey;
    keyInput.setAttribute('aria-label', 'Your delete key');
    keyInput.addEventListener('focus', () => keyInput.select());
    const keyCopy = el('button', 'btn-quiet', 'Copy key');
    keyCopy.type = 'button';
    const keyCopied = el('span', 'copied');
    keyCopied.setAttribute('role', 'status');
    keyCopy.addEventListener('click', async () => {
      keyCopied.textContent = (await copyText(deleteKey)) ? 'Key copied' : 'Press Ctrl+C to copy';
    });
    keyRow.append(keyInput, keyCopy);
    box.append(keyRow, keyCopied);
    view.append(box);
  }

  const actions = el('div', 'done-actions');
  const open = el('a', 'btn', 'View note');
  open.href = `/n/${item.id}`;
  const again = el('button', 'btn-quiet', 'Add another');
  again.type = 'button';
  again.addEventListener('click', reset);
  const hist = el('a', 'btn-quiet', `What happened on ${MONTHS[item.month - 1]} ${item.day}?`);
  hist.href = `/?date=${String(item.month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
  actions.append(open, again, hist);
  view.append(actions);

  $('formView').hidden = true;
  view.hidden = false;
  h.focus();
}

function reset() {
  form.reset();
  clearPhoto();
  dateInput.value = today;
  $('text-count').textContent = '0 / 2000';
  setHint('public');
  showStatus(status, '', '');
  $('doneView').hidden = true;
  $('formView').hidden = false;
  text.focus();
}
