import { createApp } from '../server/app.js';
import { createWikipedia } from '../server/services/wikipedia.js';
import { createMemoryStore } from '../server/stores/memoryStore.js';

export const sampleFeed = {
  events: [
    { text: 'Event with media', year: 1969, pages: [{ title: 'Apollo_11', normalizedtitle: 'Apollo 11', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Apollo_11' } }, thumbnail: { source: 'https://upload.wikimedia.org/a.jpg' } }] },
    { text: 'Unsafe links', year: 1900, pages: [{ title: 'X', content_urls: { desktop: { page: 'javascript:alert(1)' } }, thumbnail: { source: 'http://evil.example/p.png' } }] },
  ],
  births: [{ text: 'Someone born', year: 1950, pages: [] }],
  deaths: [],
  holidays: [{ text: 'A holiday', pages: [] }],
};

export async function startApp({ fetchImpl, ttlMs = 60_000, postsPerHour = 100, adminToken = '' } = {}) {
  const calls = { n: 0 };
  const fakeFetch =
    fetchImpl ||
    (async () => {
      return { ok: true, status: 200, json: async () => sampleFeed };
    });
  const wikipedia = createWikipedia({ fetchImpl: async (...a) => (calls.n++, fakeFetch(...a)), ttlMs, contact: 'test' });
  const store = createMemoryStore();
  const config = { isProd: false, siteUrl: 'http://test.local', adminToken, trustProxy: 'false', visitorPostLimit: postsPerHour };
  const app = createApp({ store, wikipedia, config });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, store, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

export const post = (base, body, headers = {}) =>
  fetch(`${base}/api/visitors`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

export const goodNote = { name: 'Krrish', place: 'Lonavala', message: 'Loved reading about my birthday.', favMonth: 10, favDay: 18 };
