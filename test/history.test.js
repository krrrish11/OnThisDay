import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

test('history: returns slimmed data, only safe URLs, and caches per date', async () => {
  const t = await startApp();
  const r1 = await fetch(`${t.base}/api/history/10/18`);
  assert.equal(r1.status, 200);
  const data = await r1.json();
  assert.deepEqual(Object.keys(data).sort(), ['births', 'deaths', 'events', 'holidays']);
  assert.equal(data.events[0].pages[0].thumbnail, 'https://upload.wikimedia.org/a.jpg');
  assert.equal(data.events[1].pages[0].url, null, 'javascript: URL must be dropped');
  assert.equal(data.events[1].pages[0].thumbnail, undefined, 'non-https thumbnail must be dropped');
  assert.equal(data.holidays[0].year, undefined);

  const r2 = await fetch(`${t.base}/api/history/10/18`);
  assert.equal(r2.headers.get('x-data-source'), 'cache');
  assert.equal(t.calls.n, 1, 'second request must not hit Wikipedia');
  await t.close();
});

test('history: rejects impossible dates', async () => {
  const t = await startApp();
  for (const p of ['13/1', '2/30', '0/5', '4/31', 'ab/cd', '1/1x']) {
    const r = await fetch(`${t.base}/api/history/${p}`);
    assert.equal(r.status, 400, p);
  }
  assert.equal((await fetch(`${t.base}/api/history/2/29`)).status, 200, 'Feb 29 is valid');
  await t.close();
});

test('history: 502 when Wikipedia is down and nothing is cached', async () => {
  const t = await startApp({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
  const r = await fetch(`${t.base}/api/history/1/1`);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /Wikipedia/);
  await t.close();
});

test('history: serves stale data when Wikipedia fails after the cache expired', async () => {
  let fail = false;
  const t = await startApp({
    ttlMs: 1,
    fetchImpl: async () => (fail ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ events: [{ text: 'cached', year: 1, pages: [] }] }) }),
  });
  assert.equal((await fetch(`${t.base}/api/history/3/3`)).status, 200);
  await new Promise((r) => setTimeout(r, 10));
  fail = true;
  const r = await fetch(`${t.base}/api/history/3/3`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-data-source'), 'stale');
  await t.close();
});

test('history: concurrent requests for one date share a single upstream call', async () => {
  const t = await startApp({ fetchImpl: async () => (await new Promise((r) => setTimeout(r, 30)), { ok: true, status: 200, json: async () => ({ events: [] }) }) });
  await Promise.all([1, 2, 3, 4].map(() => fetch(`${t.base}/api/history/5/5`)));
  assert.equal(t.calls.n, 1);
  await t.close();
});
