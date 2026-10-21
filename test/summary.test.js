import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

const wikiSummary = {
  title: 'Apollo 11', type: 'standard', description: '1969 American crewed lunar landing', extract: 'Apollo 11 was the first mission to land humans on the Moon.',
  content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Apollo_11' } },
  thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' },
};

test('summary: slimmed, safe, cached, and the title is encoded upstream', async () => {
  const urls = [];
  const t = await startApp({ fetchImpl: async (u) => (urls.push(u), { ok: true, status: 200, json: async () => ({ ...wikiSummary, thumbnail: { source: 'http://evil.example/a.jpg' }, content_urls: { desktop: { page: 'javascript:1' } }, secret: 'x' }) }) });
  const r = await fetch(`${t.base}/api/summary/Apollo%2011`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.title, 'Apollo 11');
  assert.equal(j.thumbnail, undefined);
  assert.equal(j.url, undefined);
  assert.equal(j.secret, undefined);
  assert.match(urls[0], /page\/summary\/Apollo_11\?redirect=true$/);
  await fetch(`${t.base}/api/summary/Apollo%2011`);
  assert.equal(urls.length, 1, 'second call is served from cache');
  await t.close();
});

test('summary: rejects invalid titles, maps upstream 404, and 502 when Wikipedia is down', async () => {
  let status = 404;
  const t = await startApp({ fetchImpl: async () => ({ ok: false, status, json: async () => ({}) }) });
  for (const bad of ['a%23b', 'a%3Cb', 'a%7Cb', 'x'.repeat(201)]) assert.equal((await fetch(`${t.base}/api/summary/${bad}`)).status, 400, bad);
  assert.equal((await fetch(`${t.base}/api/summary/Nope_Nope`)).status, 404);
  status = 503;
  assert.equal((await fetch(`${t.base}/api/summary/Other`)).status, 502);
  await t.close();
});

test('summary: concurrent requests share one upstream call', async () => {
  let n = 0;
  const t = await startApp({ fetchImpl: async () => (n++, await new Promise((r) => setTimeout(r, 30)), { ok: true, status: 200, json: async () => wikiSummary }) });
  await Promise.all([1, 2, 3].map(() => fetch(`${t.base}/api/summary/Apollo_11`)));
  assert.equal(n, 1);
  await t.close();
});

test('entry page: renders, is noindex, and is not in the sitemap', async () => {
  const t = await startApp();
  const html = await (await fetch(`${t.base}/entry?date=10-18&type=events&i=0`)).text();
  assert.match(html, /name="robots" content="noindex/);
  assert.match(html, /\/js\/pages\/entry\.js/);
  assert.doesNotMatch(await (await fetch(`${t.base}/sitemap.xml`)).text(), /entry/);
  await t.close();
});
