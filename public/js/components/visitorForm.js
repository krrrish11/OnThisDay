import { $ } from '../core/dom.js';
import { MONTHS, daysIn } from '../core/dates.js';
import { createVisitor } from '../api/visitors.js';

const FIELDS = ['name', 'place', 'message'];
// Mirrors the server rules so people get instant feedback. The server stays the authority.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|in|ru|cn|xyz|info|biz|link|top|shop|site|online)\b)/i;
const RULES = {
  name: { min: 2, max: 60, empty: 'Enter your name (at least 2 characters).' },
  place: { min: 0, max: 80 },
  message: { min: 5, max: 280, empty: 'Write at least 5 characters.' },
};

export function createVisitorForm({ onPosted }) {
  const form = $('visitorForm');
  const status = $('formStatus');
  const submit = $('submit');
  const favMonth = $('favMonth');
  const favDay = $('favDay');
  const message = $('message');

  /* optional "date that matters" picker */
  favMonth.append(new Option('No date', ''));
  MONTHS.forEach((name, i) => favMonth.append(new Option(name, i + 1)));
  function fillDays() {
    const m = Number(favMonth.value);
    favDay.replaceChildren();
    if (!m) {
      favDay.append(new Option('–', ''));
      favDay.disabled = true;
      return;
    }
    favDay.disabled = false;
    for (let d = 1; d <= daysIn(m); d++) favDay.append(new Option(d, d));
  }
  favMonth.addEventListener('change', fillDays);
  fillDays();

  message.addEventListener('input', () => {
    $('message-count').textContent = `${[...message.value].length} / ${RULES.message.max}`;
  });

  /* messages */
  function setError(field, text) {
    const err = $(`${field}-err`);
    if (err) err.textContent = text || '';
    const input = $(field);
    if (input) text ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid');
  }
  function clearErrors() {
    [...FIELDS, 'favDate'].forEach((f) => setError(f, ''));
    status.className = 'form-status';
    status.textContent = '';
  }
  function showStatus(kind, text) {
    status.className = `form-status ${kind}`;
    status.textContent = text;
  }

  function validate(values) {
    const errors = {};
    for (const f of FIELDS) {
      const { min, max, empty } = RULES[f];
      const len = [...values[f].trim()].length;
      if (len < min) errors[f] = empty || `Write at least ${min} characters.`;
      else if (len > max) errors[f] = `Keep this under ${max} characters.`;
      else if (values[f] && LINK.test(values[f])) errors[f] = 'Links are not allowed here.';
    }
    return errors;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const data = new FormData(form);
    const values = Object.fromEntries(FIELDS.map((f) => [f, String(data.get(f) || '')]));
    const errors = validate(values);
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([f, t]) => setError(f, t));
      showStatus('bad', 'Please fix the highlighted fields.');
      $(Object.keys(errors)[0])?.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Posting…';
    try {
      const res = await createVisitor({
        ...values,
        favMonth: data.get('favMonth') || '',
        favDay: data.get('favDay') || '',
        website: String(data.get('website') || ''),
      });
      form.reset();
      fillDays();
      $('message-count').textContent = `0 / ${RULES.message.max}`;
      showStatus('ok', 'Thank you. Your note is on the wall.');
      if (res.item) onPosted(res.item);
    } catch (err) {
      if (err.errors) {
        Object.entries(err.errors).forEach(([f, t]) => setError(f, t));
        $(Object.keys(err.errors)[0])?.focus();
      }
      showStatus('bad', err.errors ? 'Please fix the highlighted fields.' : err.message || 'Could not post your note. Please try again.');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Post note';
    }
  });
}
