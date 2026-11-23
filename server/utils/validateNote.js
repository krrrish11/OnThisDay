import { isRealDate } from './dates.js';
import { parsePhoto } from './jpeg.js';

export const NOTE_LIMITS = { textMin: 3, textMax: 2000, nameMax: 40, minYear: 1900 };
// Public notes may not carry links (spam and phishing). Private notes are only ever seen by their owner.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|in|ru|cn|xyz|info|biz|link|top|shop|site|online)\b)/i;
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g;
const DAY_MS = 86_400_000;

const cleanText = (v) =>
  String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const cleanLine = (v) => cleanText(v).replace(/\s+/g, ' ');
const len = (s) => [...s].length;

export function parseDate(raw, now = new Date()) {
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (raw === undefined || raw === null || raw === '') {
    return { y: todayUtc.getUTCFullYear(), m: todayUtc.getUTCMonth() + 1, d: todayUtc.getUTCDate() };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < NOTE_LIMITS.minYear || !isRealDate(y, mo, d)) return null;
  // One day of slack: a reader east of UTC can already be "tomorrow".
  if (Date.UTC(y, mo - 1, d) > todayUtc.getTime() + DAY_MS) return null;
  return { y, m: mo, d };
}

/** Returns { value } or { errors: { field: message } }. Never throws. */
export function validateNote(body, now = new Date()) {
  const src = body && typeof body === 'object' ? body : {};
  const errors = {};
  const isPrivate = src.isPrivate === true || src.isPrivate === 'true';
  const text = cleanText(src.text);
  const name = cleanLine(src.name);

  const n = len(text);
  if (n < NOTE_LIMITS.textMin) errors.text = `Write at least ${NOTE_LIMITS.textMin} characters.`;
  else if (n > NOTE_LIMITS.textMax) errors.text = `Keep your note under ${NOTE_LIMITS.textMax} characters.`;
  else if (!isPrivate && LINK.test(text)) errors.text = 'Links are not allowed in public notes. Make it private, or remove the link.';

  if (len(name) > NOTE_LIMITS.nameMax) errors.name = `Keep the name under ${NOTE_LIMITS.nameMax} characters.`;
  else if (name && !isPrivate && LINK.test(name)) errors.name = 'Links are not allowed in names.';

  const date = parseDate(src.date, now);
  if (!date) errors.date = 'Choose a real date, from 1900 up to today.';

  let photo = null;
  if (src.photo !== undefined && src.photo !== null && src.photo !== '') {
    const res = parsePhoto(src.photo);
    if (res.error) errors.photo = res.error;
    else photo = res.photo;
  }

  if (Object.keys(errors).length) return { errors };
  return { value: { text, name, year: date.y, month: date.m, day: date.d, isPrivate, photo } };
}
