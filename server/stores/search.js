import { normalizeId } from '../utils/ids.js';

/**
 * "birthday cake" -> every word must appear in the note text or the name, in any order.
 * A search that is exactly a note ID ("k7m2qx") also matches that note.
 */
export function buildSearch(q) {
  const raw = String(q ?? '').trim().slice(0, 80);
  if (!raw) return null;
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  return { words, id: normalizeId(raw) };
}

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
