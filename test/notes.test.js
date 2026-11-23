import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, api, fakeJpeg, jpegDataUrl, note, signUp } from './helpers.js';

const ID = /^[A-HJ-NP-Z2-9]{6}$/;
const post = (t, body, cookie) => api(t.base, 'POST', '/api/notes', { body, cookie });

test('notes: create as a guest returns a short ID and a delete key, and the note is listed', async () => {
  const t = await startApp();
  const r = await post(t, note);
  assert.equal(r.status, 201);
  assert.match(r.body.item.id, ID);
  assert.ok(r.body.deleteKey.length >= 20);
  assert.equal(r.body.item.date, '2025-07-20');
  assert.equal(r.body.item.isPrivate, false);
  // nothing secret leaks into the public shape
  assert.deepEqual(Object.keys(r.body.item).sort(), ['createdAt', 'date', 'day', 'hasPhoto', 'id', 'isPrivate', 'mine', 'month', 'name', 'text', 'year']);

  const list = await api(t.base, 'GET', '/api/notes');
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].id, r.body.item.id);
  assert.doesNotMatch(JSON.stringify(list.body), /deleteKey|ownerId|Hash|photo"/);
  assert.equal((await api(t.base, 'GET', `/api/notes/${r.body.item.id.toLowerCase()}`)).body.item.text, note.text);
  await t.close();
});

test('notes: IDs are unique and never use confusing characters', async () => {
  const t = await startApp();
  const ids = new Set();
  for (let i = 0; i < 40; i++) ids.add((await post(t, { ...note, text: `Memory number ${i}` })).body.item.id);
  assert.equal(ids.size, 40);
  for (const id of ids) assert.match(id, ID);
  await t.close();
});

test('notes: validation names the field', async () => {
  const t = await startApp();
  const tomorrowPlus = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const cases = [
    [{ ...note, text: 'hi' }, 'text'],
    [{ ...note, text: 'x'.repeat(2001) }, 'text'],
    [{ ...note, text: 'see https://spam.example now' }, 'text'],
    [{ ...note, text: 'visit my-site.com please' }, 'text'],
    [{ ...note, name: 'n'.repeat(41) }, 'name'],
    [{ ...note, date: '2025-02-30' }, 'date'],
    [{ ...note, date: '1899-12-31' }, 'date'],
    [{ ...note, date: tomorrowPlus }, 'date'],
    [{ ...note, date: '20/07/2025' }, 'date'],
    [{ ...note, photo: 'data:image/png;base64,AAAA' }, 'photo'],
    [{ ...note, photo: 'not a data url' }, 'photo'],
    [{ ...note, photo: jpegDataUrl(Buffer.from('definitely not a jpeg')) }, 'photo'],
    [{ ...note, photo: jpegDataUrl(fakeJpeg().subarray(0, 20)) }, 'photo'], // truncated
    [{ ...note, photo: jpegDataUrl(fakeJpeg({ w: 5000, h: 100 })) }, 'photo'],
    [{ ...note, photo: jpegDataUrl(fakeJpeg({ pad: 310 * 1024 })) }, 'photo'],
  ];
  for (const [body, field] of cases) {
    const r = await post(t, body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
    assert.ok(r.body.errors[field], `expected an error on ${field}`);
  }
  assert.equal((await api(t.base, 'GET', '/api/notes')).body.total, 0);
  await t.close();
});

test('notes: text keeps line breaks, name is optional, date defaults to today, 2000 characters fit', async () => {
  const t = await startApp();
  const r = await post(t, { text: 'Line one\r\n\r\n\r\n\r\nLine two   with   spaces' });
  assert.equal(r.status, 201);
  assert.equal(r.body.item.text, 'Line one\n\nLine two with spaces');
  assert.equal(r.body.item.name, '');
  assert.equal(r.body.item.date, new Date().toISOString().slice(0, 10));
  assert.equal((await post(t, { ...note, text: 'é'.repeat(2000) })).status, 201);
  await t.close();
});

test('notes: HTML in a note is stored as plain text, never interpreted', async () => {
  const t = await startApp();
  const r = await post(t, { ...note, text: '<img src=x onerror=alert(1)> hello there' });
  assert.equal(r.body.item.text, '<img src=x onerror=alert(1)> hello there');
  const page = await fetch(`${t.base}/n/${r.body.item.id}`);
  assert.doesNotMatch(await page.text(), /<img src=x/, 'the share page escapes note text in meta tags');
  await t.close();
});

test('photos: stored, served as image/jpeg, and 404 when a note has none', async () => {
  const t = await startApp();
  const jpg = fakeJpeg({ pad: 2000 });
  const withPhoto = (await post(t, { ...note, photo: jpegDataUrl(jpg) })).body.item;
  const without = (await post(t, note)).body.item;
  assert.equal(withPhoto.hasPhoto, true);
  assert.equal(without.hasPhoto, false);
  const img = await fetch(`${t.base}/api/notes/${withPhoto.id}/photo`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), jpg);
  assert.equal((await fetch(`${t.base}/api/notes/${without.id}/photo`)).status, 404);
  assert.match(await (await fetch(`${t.base}/n/${withPhoto.id}`)).text(), /og:image" content="http:\/\/test\.local\/api\/notes\/[A-Z0-9]{6}\/photo"/);
  await t.close();
});

test('wall: search by word, name, several words, and exact ID', async () => {
  const t = await startApp();
  const a = (await post(t, { text: 'Birthday cake with the whole family', name: 'Asha', date: '2024-03-12' })).body.item;
  await post(t, { text: 'First day at the new college', name: 'Ravi', date: '2023-09-16' });
  await post(t, { text: 'A quiet walk by the lake', name: 'Asha', date: '2022-11-02' });
  const q = async (s) => (await api(t.base, 'GET', `/api/notes?q=${encodeURIComponent(s)}`)).body;
  assert.equal((await q('birthday')).total, 1);
  assert.equal((await q('BIRTH')).total, 1, 'partial, case-insensitive');
  assert.equal((await q('asha')).total, 2, 'by name');
  assert.equal((await q('asha lake')).total, 1, 'every word must match, in any order');
  assert.equal((await q('lake asha')).total, 1);
  assert.equal((await q('zebra')).total, 0);
  const byId = await q(a.id.toLowerCase());
  assert.equal(byId.total, 1);
  assert.equal(byId.items[0].id, a.id);
  assert.equal((await q('.*')).total, 0, 'regex characters are plain text');
  await t.close();
});

test('wall: filter by month+day, by year, and both; bad filters are 400', async () => {
  const t = await startApp();
  await post(t, { ...note, text: 'July twentieth, this year', date: '2025-07-20' });
  await post(t, { ...note, text: 'July twentieth, long ago', date: '2019-07-20' });
  await post(t, { ...note, text: 'Another day entirely', date: '2025-08-01' });
  const n = async (qs) => (await api(t.base, 'GET', `/api/notes?${qs}`)).body.total;
  assert.equal(await n('month=7&day=20'), 2);
  assert.equal(await n('year=2025'), 2);
  assert.equal(await n('month=7&day=20&year=2019'), 1);
  assert.equal(await n('month=7&day=20&q=long'), 1);
  for (const qs of ['month=2&day=30', 'month=13&day=1', 'month=7', 'year=1800', 'year=abc', 'before=garbage']) {
    assert.equal((await api(t.base, 'GET', `/api/notes?${qs}`)).status, 400, qs);
  }
  await t.close();
});

test('wall: 20 per page by default, cursor walk has no repeats or gaps', async () => {
  const t = await startApp();
  for (let i = 1; i <= 25; i++) await post(t, { ...note, text: `Memory number ${String(i).padStart(2, '0')}` });
  const first = (await api(t.base, 'GET', '/api/notes')).body;
  assert.equal(first.items.length, 20);
  assert.ok(first.nextCursor);
  assert.equal(first.total, 25);
  const second = (await api(t.base, 'GET', `/api/notes?before=${first.nextCursor}`)).body;
  assert.equal(second.items.length, 5);
  assert.equal(second.nextCursor, null);
  const all = [...first.items, ...second.items].map((i) => i.text);
  assert.equal(new Set(all).size, 25);
  assert.equal(all[0], 'Memory number 25', 'newest first');
  await t.close();
});

test('delete: only the right key works, then the note is gone', async () => {
  const t = await startApp();
  const { item, deleteKey } = (await post(t, note)).body;
  const del = (headers) => api(t.base, 'DELETE', `/api/notes/${item.id}`, { headers });
  assert.equal((await del({})).status, 403);
  assert.equal((await del({ 'x-delete-key': 'wrong-key' })).status, 403);
  assert.equal((await del({ 'x-delete-key': deleteKey.slice(0, -1) })).status, 403);
  assert.equal((await api(t.base, 'GET', '/api/notes')).body.total, 1);
  assert.equal((await del({ 'x-delete-key': deleteKey })).status, 200);
  assert.equal((await api(t.base, 'GET', `/api/notes/${item.id}`)).status, 404);
  assert.equal((await del({ 'x-delete-key': deleteKey })).status, 404);
  assert.equal((await api(t.base, 'GET', '/api/notes')).body.total, 0);
  await t.close();
});

test('delete: the database never holds the key, only a hash', async () => {
  const t = await startApp();
  const { item, deleteKey } = (await post(t, note)).body;
  const row = await t.store.notes.getById(item.id);
  assert.notEqual(row.deleteKeyHash, deleteKey);
  assert.match(row.deleteKeyHash, /^[0-9a-f]{64}$/);
  await t.close();
});

test('admin: moderation is hidden without ADMIN_TOKEN, and works with it', async () => {
  let t = await startApp();
  assert.equal((await api(t.base, 'GET', '/api/admin/notes')).status, 404);
  await t.close();

  t = await startApp({ adminToken: 'admin-secret' });
  const { item } = (await post(t, note)).body;
  const priv = await signUp(t.base, 'owner1');
  const secret = (await post(t, { ...note, text: 'my private diary entry', isPrivate: true }, priv.cookie)).body.item;
  const auth = { authorization: 'Bearer admin-secret' };
  assert.equal((await api(t.base, 'GET', '/api/admin/notes')).status, 401);
  assert.equal((await api(t.base, 'GET', '/api/admin/notes', { headers: { authorization: 'Bearer nope' } })).status, 401);
  assert.equal((await api(t.base, 'GET', '/api/admin/ping', { headers: auth })).status, 200);
  const list = await api(t.base, 'GET', '/api/admin/notes', { headers: auth });
  assert.deepEqual(list.body.items.map((i) => i.id), [item.id], 'private notes stay out of moderation');
  assert.equal((await api(t.base, 'DELETE', `/api/admin/notes/${item.id}`)).status, 401);
  assert.equal((await api(t.base, 'DELETE', `/api/admin/notes/${item.id}`, { headers: auth })).status, 200);
  assert.equal((await api(t.base, 'DELETE', `/api/admin/notes/${item.id}`, { headers: auth })).status, 404);
  assert.equal((await api(t.base, 'GET', `/api/notes/${secret.id}`, { cookie: priv.cookie })).status, 200);
  await t.close();
});

test('rate limit: 10 notes an hour per network address by default, then a friendly 429', async () => {
  const t = await startApp({ notesPerHour: 3 });
  for (let i = 0; i < 3; i++) assert.equal((await post(t, note)).status, 201);
  const r = await post(t, note);
  assert.equal(r.status, 429);
  assert.match(r.body.error, /try again/i);
  assert.equal((await api(t.base, 'GET', '/api/notes')).body.total, 3);
  await t.close();
});

test('rate limit: invalid posts do not use up the allowance', async () => {
  const t = await startApp({ notesPerHour: 2 });
  for (let i = 0; i < 5; i++) assert.equal((await post(t, { ...note, text: 'x' })).status, 400);
  assert.equal((await post(t, note)).status, 201);
  assert.equal((await post(t, note)).status, 201);
  await t.close();
});

test('rate limit: also counted per signed-in user, even from different addresses', async () => {
  const t = await startApp({ notesPerHour: 2, config: { trustProxy: '1' } });
  const { cookie } = await signUp(t.base, 'poster');
  const from = (ip) => api(t.base, 'POST', '/api/notes', { body: note, cookie, headers: { 'x-forwarded-for': ip } });
  assert.equal((await from('10.0.0.1')).status, 201);
  assert.equal((await from('10.0.0.2')).status, 201);
  assert.equal((await from('10.0.0.3')).status, 429, 'a new IP does not reset the user limit');
  // a guest on yet another address is unaffected
  const guest = await api(t.base, 'POST', '/api/notes', { body: note, headers: { 'x-forwarded-for': '10.0.0.9' } });
  assert.equal(guest.status, 201);
  await t.close();
});

test('notes: honeypot, oversized body and bad JSON are handled', async () => {
  const t = await startApp();
  assert.equal((await post(t, { ...note, website: 'http://bot.example' })).status, 201);
  assert.equal((await api(t.base, 'GET', '/api/notes')).body.total, 0);
  const big = await fetch(`${t.base}/api/notes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...note, pad: 'x'.repeat(800 * 1024) }) });
  assert.equal(big.status, 413);
  const bad = await fetch(`${t.base}/api/notes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(bad.status, 400);
  await t.close();
});

test('on this day: groups by year (newest first), same day only, defaults to today', async () => {
  const t = await startApp();
  await post(t, { ...note, text: 'Twenty twenty-three', date: '2023-07-20' });
  await post(t, { ...note, text: 'Twenty twenty-five A', date: '2025-07-20' });
  await post(t, { ...note, text: 'Twenty twenty-five B', date: '2025-07-20' });
  await post(t, { ...note, text: 'Different day', date: '2025-07-21' });
  const r = (await api(t.base, 'GET', '/api/on-this-day?month=7&day=20')).body;
  assert.equal(r.total, 3);
  assert.deepEqual(r.groups.map((g) => [g.year, g.items.length]), [[2025, 2], [2023, 1]]);
  assert.equal((await api(t.base, 'GET', '/api/on-this-day?month=2&day=31')).status, 400);
  const empty = (await api(t.base, 'GET', '/api/on-this-day?month=1&day=1')).body;
  assert.deepEqual(empty.groups, []);
  assert.equal((await api(t.base, 'GET', '/api/on-this-day')).status, 200);
  await t.close();
});
