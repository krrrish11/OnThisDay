import { randomInt } from 'node:crypto';

// 32 symbols, no 0/O or 1/I, so an ID read aloud or off a screenshot can be typed back without guessing.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export const newNoteId = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** "k7m2qx" -> "K7M2QX"; anything that is not a valid ID -> null. */
export function normalizeId(raw) {
  const id = String(raw ?? '').trim().toUpperCase();
  return ID_RE.test(id) ? id : null;
}
