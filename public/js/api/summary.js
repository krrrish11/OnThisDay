import { request } from './http.js';

const cache = new Map(); // title -> promise

/** Wikipedia's short summary for an article title. Cached for the page's lifetime. */
export function fetchSummary(title) {
  if (!cache.has(title)) {
    const p = request(`/api/summary/${encodeURIComponent(title)}`);
    p.catch(() => cache.delete(title)); // let a failed lookup be retried
    cache.set(title, p);
  }
  return cache.get(title);
}
