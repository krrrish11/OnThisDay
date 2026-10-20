import { isValidMonthDay } from './dates.js';

const LIMITS = { name: [2, 60], place: [0, 80], message: [5, 280] };
// Public wall: no links, so it cannot be used to advertise or phish.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|in|ru|cn|xyz|info|biz|link|top|shop|site|online)\b)/i;
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g;

const clean = (v) => String(v ?? '').replace(CONTROL, '').replace(/\s+/g, ' ').trim();

/** Returns { value } on success or { errors: { field: message } }. Never throws. */
export function validateVisitor(body) {
  const src = body && typeof body === 'object' ? body : {};
  const errors = {};
  const value = {
    name: clean(src.name),
    place: clean(src.place),
    message: clean(src.message),
    favDate: null,
  };

  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const len = [...value[field]].length;
    if (len < min) errors[field] = field === 'name' ? 'Enter your name (at least 2 characters).' : `Write at least ${min} characters.`;
    else if (len > max) errors[field] = `Keep this under ${max} characters.`;
    else if (value[field] && LINK.test(value[field])) errors[field] = 'Links are not allowed here.';
  }

  const fm = src.favMonth ?? src.favDate?.m;
  const fd = src.favDay ?? src.favDate?.d;
  if (fm !== undefined && fm !== null && fm !== '') {
    const m = Number(fm), d = Number(fd);
    if (!isValidMonthDay(m, d)) errors.favDate = 'Choose a real month and day.';
    else value.favDate = { m, d };
  }

  return Object.keys(errors).length ? { errors } : { value };
}
