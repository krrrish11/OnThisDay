import { request } from './http.js';
import { toParam } from '../core/dates.js';

const cache = new Map(); // "MM-DD" -> data
const pending = new Map(); // "MM-DD" -> promise (so quick repeat requests share one fetch)

/** Returns { events, births, deaths, holidays } for a date. Cached for the page's lifetime. */
export function fetchDay({ m, d }) {
  const key = toParam({ m, d });
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (!pending.has(key)) {
    pending.set(
      key,
      request(`/api/history/${key.replace('-', '/')}`)
        .then((data) => {
          cache.set(key, data);
          return data;
        })
        .finally(() => pending.delete(key)),
    );
  }
  return pending.get(key);
}
