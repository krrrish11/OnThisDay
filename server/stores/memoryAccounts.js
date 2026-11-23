import { randomBytes } from 'node:crypto';
import { decodeCursor } from './cursor.js';
import { noteCursor } from './rows.js';
import { buildSearch } from './search.js';

/** Development/test stores for notes, users and rate-limit hits. Data disappears on restart. */

export function createMemoryNotes({ max = 5000 } = {}) {
  let rows = []; // newest first

  function matches(r, f) {
    if (f.ownerId ? r.ownerId !== f.ownerId : r.isPrivate) return false;
    if (f.month && (r.month !== f.month || r.day !== f.day)) return false;
    if (f.year && r.year !== f.year) return false;
    if (f.search) {
      const hay = `${r.text}\n${r.name}`.toLowerCase();
      if (!(f.search.id === r.id || f.search.words.every((w) => hay.includes(w)))) return false;
    }
    return true;
  }
  const strip = ({ photo, ...rest }) => rest;

  return {
    async create(doc) {
      if (rows.some((r) => r.id === doc.id)) throw Object.assign(new Error('duplicate id'), { duplicateId: true });
      const row = {
        ...doc,
        photo: doc.photo ? doc.photo.buffer : null,
        photoMime: doc.photo ? doc.photo.mime : null,
        hasPhoto: Boolean(doc.photo),
        _id: randomBytes(12).toString('hex'),
        createdAt: new Date(),
      };
      rows.unshift(row);
      rows = rows.slice(0, max);
      return strip(row);
    },
    async getById(id) {
      const r = rows.find((x) => x.id === id);
      return r ? strip(r) : null;
    },
    async getPhoto(id) {
      const r = rows.find((x) => x.id === id);
      return r?.photo ? { buffer: r.photo, mime: r.photoMime, ownerId: r.ownerId, isPrivate: r.isPrivate } : null;
    },
    async list({ q, month, day, year, ownerId, limit, before }) {
      const f = { search: buildSearch(q), month, day, year, ownerId };
      const all = rows.filter((r) => matches(r, f));
      const cur = decodeCursor(before);
      let start = 0;
      if (cur) {
        start = all.findIndex((r) => r.createdAt.getTime() < cur.ms || (r.createdAt.getTime() === cur.ms && r._id < cur.id));
        if (start === -1) start = all.length;
      }
      const slice = all.slice(start, start + limit + 1);
      const items = slice.slice(0, limit).map(strip);
      return { items, nextCursor: slice.length > limit ? noteCursor(items[items.length - 1]) : null, total: all.length };
    },
    async onThisDay({ month, day, viewerId, limit }) {
      const all = rows
        .filter((r) => r.month === month && r.day === day && (!r.isPrivate || (viewerId && r.ownerId === viewerId)))
        .sort((a, b) => b.year - a.year || b.createdAt - a.createdAt);
      return { items: all.slice(0, limit).map(strip), total: all.length };
    },
    async remove(id) {
      const n = rows.length;
      rows = rows.filter((r) => r.id !== id);
      return rows.length < n;
    },
  };
}

export function createMemoryUsers() {
  const users = [];
  const view = (u) => ({ id: u.id, username: u.username, passwordHash: u.passwordHash });
  return {
    async create({ username, passwordHash }) {
      if (users.some((u) => u.username === username)) throw Object.assign(new Error('duplicate username'), { duplicateUsername: true });
      const u = { id: randomBytes(12).toString('hex'), username, passwordHash, createdAt: new Date() };
      users.push(u);
      return view(u);
    },
    async findByUsername(username) {
      const u = users.find((x) => x.username === username);
      return u ? view(u) : null;
    },
    async findById(id) {
      const u = users.find((x) => x.id === id);
      return u ? view(u) : null;
    },
  };
}

export function createMemoryRate() {
  const hits = new Map(); // key -> [timestamps]
  return {
    /** Counts this attempt if allowed. Returns { allowed }. */
    async hit(key, { limit, windowMs }) {
      const now = Date.now();
      const recent = (hits.get(key) || []).filter((t) => t > now - windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true };
    },
    /** Checks without counting. */
    async peek(key, { limit, windowMs }) {
      const now = Date.now();
      return { allowed: (hits.get(key) || []).filter((t) => t > now - windowMs).length < limit };
    },
  };
}
