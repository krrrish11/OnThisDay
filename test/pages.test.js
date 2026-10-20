import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

test('pages: each route renders with shared navbar/footer and the right current link', async () => {
  const t = await startApp();
  const expect = { '/': 'Explore', '/visitors': 'Visitors', '/about': 'About' };
  for (const [path, name] of Object.entries(expect)) {
    const r = await fetch(`${t.base}${path}`);
    assert.equal(r.status, 200, path);
    const html = await r.text();
    assert.match(html, /<header class="site-header">/);
    assert.match(html, /<footer class="site-footer">/);
    assert.doesNotMatch(html, /\{\{/, 'no unreplaced template tokens');
    const current = [...html.matchAll(/<a href="[^"]*" aria-current="page">([^<]+)</g)].map((m) => m[1]);
    assert.deepEqual(current, [name], path);
    assert.match(html, /<link rel="canonical" href="http:\/\/test\.local/);
  }
  await t.close();
});

test('pages: unknown path is a 404 page, unknown API path is JSON 404', async () => {
  const t = await startApp();
  const page = await fetch(`${t.base}/does-not-exist`);
  assert.equal(page.status, 404);
  assert.match(await page.text(), /not in the archive/);
  const api = await fetch(`${t.base}/api/nope`);
  assert.equal(api.status, 404);
  assert.equal((await api.json()).error, 'Not found.');
  await t.close();
});

test('pages: CSP allows only self + the import map hash, and other security headers are set', async () => {
  const t = await startApp();
  const r = await fetch(`${t.base}/`);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
  await t.close();
});

test('pages: static assets, vendor three.js, robots and sitemap are served', async () => {
  const t = await startApp();
  for (const [p, type] of [
    ['/css/base.css', /css/],
    ['/js/pages/explore.js', /javascript/],
    ['/fonts/fraunces-latin-opsz-normal.woff2', /woff2|octet/],
    ['/vendor/three/build/three.module.js', /javascript/],
    ['/vendor/three/examples/jsm/environments/RoomEnvironment.js', /javascript/],
    ['/favicon.svg', /svg/],
    ['/site.webmanifest', /./],
    ['/robots.txt', /text\/plain/],
    ['/sitemap.xml', /xml/],
  ]) {
    const r = await fetch(`${t.base}${p}`);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-type') || '', type, p);
  }
  assert.match(await (await fetch(`${t.base}/sitemap.xml`)).text(), /http:\/\/test\.local\/visitors/);
  await t.close();
});

test('health: reports the store', async () => {
  const t = await startApp();
  const h = await (await fetch(`${t.base}/api/health`)).json();
  assert.equal(h.ok, true);
  assert.equal(h.store, 'memory');
  await t.close();
});
