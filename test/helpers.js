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

export async function startApp({ fetchImpl, ttlMs = 60_000, postsPerHour = 100, notesPerHour = 100, adminToken = '', config: extra = {} } = {}) {
  const calls = { n: 0 };
  const fakeFetch =
    fetchImpl ||
    (async () => {
      return { ok: true, status: 200, json: async () => sampleFeed };
    });
  const wikipedia = createWikipedia({ fetchImpl: async (...a) => (calls.n++, fakeFetch(...a)), ttlMs, contact: 'test' });
  const store = createMemoryStore();
  const config = { isProd: false, siteUrl: 'http://test.local', adminToken, trustProxy: 'false', visitorPostLimit: postsPerHour, sessionSecret: 'test-secret-test-secret', notePostLimit: notesPerHour, ...extra };
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

/** A tiny structurally valid JPEG (header, frame size, end marker). Enough for the server's checks; not decodable. */
export function fakeJpeg({ w = 640, h = 480, pad = 0 } = {}) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]), sof, Buffer.alloc(pad), Buffer.from([0xff, 0xd9])]);
}
export const jpegDataUrl = (buf) => `data:image/jpeg;base64,${buf.toString('base64')}`;

/** fetch helper that returns { status, body, headers } and can carry a session cookie. */
export async function api(base, method, path, { body, cookie, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('json')) json = await res.json();
  return { status: res.status, body: json, headers: res.headers, res };
}

export const cookieFrom = (res) => (res.headers.getSetCookie?.()[0] || '').split(';')[0];

export async function signUp(base, username = 'krrish', password = 'correct horse') {
  const r = await api(base, 'POST', '/api/auth/register', { body: { username, password } });
  return { cookie: cookieFrom(r), user: r.body?.user, status: r.status };
}

export const note = { text: 'Reached Lonavala and saw the lake for the first time.', name: 'Krrish', date: '2025-07-20' };
