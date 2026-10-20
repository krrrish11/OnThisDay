import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, post, goodNote } from './helpers.js';

test('visitors: create, then list newest first with total', async () => {
  const t = await startApp();
  const r = await post(t.base, goodNote);
  assert.equal(r.status, 201);
  const { item } = await r.json();
  assert.equal(item.name, 'Krrish');
  assert.deepEqual(item.favDate, { m: 10, d: 18 });
  await post(t.base, { ...goodNote, name: 'Second', message: 'A second note here.' });
  const list = await (await fetch(`${t.base}/api/visitors`)).json();
  assert.equal(list.total, 2);
  assert.equal(list.items[0].name, 'Second');
  assert.equal(list.items[1].name, 'Krrish');
  await t.close();
});

test('visitors: validation errors name the field', async () => {
  const t = await startApp();
  const cases = [
    [{ ...goodNote, name: 'K' }, 'name'],
    [{ ...goodNote, message: 'hey' }, 'message'],
    [{ ...goodNote, message: 'visit https://spam.example now' }, 'message'],
    [{ ...goodNote, message: 'visit my-site.com now please' }, 'message'],
    [{ ...goodNote, place: 'x'.repeat(81) }, 'place'],
    [{ ...goodNote, favMonth: 2, favDay: 30 }, 'favDate'],
    [{ ...goodNote, favMonth: 13, favDay: 1 }, 'favDate'],
  ];
  for (const [body, field] of cases) {
    const r = await post(t.base, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok((await r.json()).errors[field], `expected error on ${field}`);
  }
  assert.equal((await (await fetch(`${t.base}/api/visitors`)).json()).total, 0);
  await t.close();
});

test('visitors: optional fields really are optional; whitespace is normalised', async () => {
  const t = await startApp();
  const r = await post(t.base, { name: '  Asha   K  ', message: 'Hello   from   here' });
  assert.equal(r.status, 201);
  const { item } = await r.json();
  assert.equal(item.name, 'Asha K');
  assert.equal(item.message, 'Hello from here');
  assert.equal(item.favDate, null);
  assert.equal(item.place, '');
  await t.close();
});

test('visitors: honeypot gets a fake success and stores nothing', async () => {
  const t = await startApp();
  const r = await post(t.base, { ...goodNote, website: 'http://bot.example' });
  assert.equal(r.status, 201);
  assert.equal((await (await fetch(`${t.base}/api/visitors`)).json()).total, 0);
  await t.close();
});

test('visitors: HTML in a note is stored as text (the page renders it with textContent)', async () => {
  const t = await startApp();
  const r = await post(t.base, { name: 'Eve', message: '<img src=x onerror=alert(1)> hi there' });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).item.message, '<img src=x onerror=alert(1)> hi there');
  await t.close();
});

test('visitors: rate limit returns 429 after the hourly allowance', async () => {
  const t = await startApp({ postsPerHour: 3 });
  for (let i = 0; i < 3; i++) assert.equal((await post(t.base, goodNote)).status, 201);
  const r = await post(t.base, goodNote);
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /try again/i);
  await t.close();
});

test('visitors: cursor pagination walks the whole list without repeats', async () => {
  const t = await startApp();
  for (let i = 1; i <= 5; i++) await post(t.base, { ...goodNote, name: `User ${i}`, message: `Note number ${i}` });
  const seen = [];
  let before;
  for (let guard = 0; guard < 10; guard++) {
    const page = await (await fetch(`${t.base}/api/visitors?limit=2${before ? `&before=${before}` : ''}`)).json();
    seen.push(...page.items.map((i) => i.name));
    if (!page.nextCursor) break;
    before = page.nextCursor;
  }
  assert.deepEqual(seen, ['User 5', 'User 4', 'User 3', 'User 2', 'User 1']);
  assert.equal((await fetch(`${t.base}/api/visitors?before=garbage`)).status, 400);
  await t.close();
});

test('visitors: malformed JSON is a clean 400', async () => {
  const t = await startApp();
  const r = await fetch(`${t.base}/api/visitors`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(r.status, 400);
  await t.close();
});

test('visitors: moderation delete is hidden without ADMIN_TOKEN and protected with it', async () => {
  let t = await startApp();
  assert.equal((await fetch(`${t.base}/api/visitors/abc`, { method: 'DELETE' })).status, 404);
  await t.close();

  t = await startApp({ adminToken: 's3cret-token' });
  const { item } = await (await post(t.base, goodNote)).json();
  assert.equal((await fetch(`${t.base}/api/visitors/${item.id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await fetch(`${t.base}/api/visitors/${item.id}`, { method: 'DELETE', headers: { authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await fetch(`${t.base}/api/visitors/${item.id}`, { method: 'DELETE', headers: { authorization: 'Bearer s3cret-token' } })).status, 200);
  assert.equal((await fetch(`${t.base}/api/visitors/${item.id}`, { method: 'DELETE', headers: { authorization: 'Bearer s3cret-token' } })).status, 404);
  assert.equal((await (await fetch(`${t.base}/api/visitors`)).json()).total, 0);
  await t.close();
});
