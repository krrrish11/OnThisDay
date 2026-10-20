import { randomBytes } from 'node:crypto';
import { decodeCursor, encodeCursor, toPublic } from './cursor.js';

/** Development/test store. Data disappears on restart — never used in production. */
export function createMemoryStore({ max = 500 } = {}) {
  let rows = []; // newest first

  return {
    kind: 'memory',
    async list({ limit, before }) {
      const cur = decodeCursor(before);
      let start = 0;
      if (cur) {
        start = rows.findIndex((r) => r.createdAt.getTime() < cur.ms || (r.createdAt.getTime() === cur.ms && r._id < cur.id));
        if (start === -1) start = rows.length;
      }
      const slice = rows.slice(start, start + limit + 1);
      const items = slice.slice(0, limit).map(toPublic);
      return { items, nextCursor: slice.length > limit ? encodeCursor(items[items.length - 1]) : null };
    },
    async count() {
      return rows.length;
    },
    async create(value) {
      const row = { ...value, _id: randomBytes(12).toString('hex'), createdAt: new Date() };
      rows.unshift(row);
      rows = rows.slice(0, max);
      return toPublic(row);
    },
    async remove(id) {
      const before = rows.length;
      rows = rows.filter((r) => r._id !== id);
      return rows.length < before;
    },
    ping: () => true,
    close: async () => {},
  };
}
