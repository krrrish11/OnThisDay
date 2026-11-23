import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, api, cookieFrom, fakeJpeg, jpegDataUrl, note, signUp } from './helpers.js';

test('auth: register sets an httpOnly, SameSite cookie and signs you in', async () => {
  const t = await startApp();
  const r = await api(t.base, 'POST', '/api/auth/register', { body: { username: 'Krrish_11', password: 'a long password' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.username, 'krrish_11', 'usernames are stored lowercase');
  const setCookie = r.headers.getSetCookie()[0];
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Max-Age=\d+/);
  const me = await api(t.base, 'GET', '/api/auth/me', { cookie: cookieFrom(r) });
  assert.equal(me.body.user.username, 'krrish_11');
  assert.equal((await api(t.base, 'GET', '/api/auth/me')).body.user, null);
  await t.close();
});

test('auth: passwords are stored as bcrypt hashes', async () => {
  const t = await startApp();
  await signUp(t.base, 'hashed', 'plain-text-password');
  const u = await t.store.users.findByUsername('hashed');
  assert.match(u.passwordHash, /^\$2[aby]\$\d\d\$/);
  assert.doesNotMatch(u.passwordHash, /plain-text-password/);
  await t.close();
});

test('auth: duplicate usernames (any case) and weak input are rejected', async () => {
  const t = await startApp();
  await signUp(t.base, 'taken_name');
  const dupe = await api(t.base, 'POST', '/api/auth/register', { body: { username: 'TAKEN_NAME', password: 'another password' } });
  assert.equal(dupe.status, 409);
  assert.ok(dupe.body.errors.username);
  await t.close();
  const t2 = await startApp();
  for (const body of [
    { username: 'ab', password: 'long enough pw' },
    { username: 'has space', password: 'long enough pw' },
    { username: 'x'.repeat(21), password: 'long enough pw' },
    { username: 'valid_name', password: 'short' },
    { username: 'valid_name', password: 'x'.repeat(73) },
    { username: 'same_as_pw', password: 'same_as_pw' },
    {},
  ]) assert.equal((await api(t2.base, 'POST', '/api/auth/register', { body })).status, 400, JSON.stringify(body));
  await t2.close();
});

test('auth: login, wrong password and unknown user look the same, logout clears the cookie', async () => {
  const t = await startApp();
  await signUp(t.base, 'real_user', 'the right password');
  const ok = await api(t.base, 'POST', '/api/auth/login', { body: { username: 'REAL_USER', password: 'the right password' } });
  assert.equal(ok.status, 200);
  const wrong = await api(t.base, 'POST', '/api/auth/login', { body: { username: 'real_user', password: 'the wrong password' } });
  const ghost = await api(t.base, 'POST', '/api/auth/login', { body: { username: 'no_such_user', password: 'whatever password' } });
  assert.equal(wrong.status, 401);
  assert.equal(ghost.status, 401);
  assert.equal(wrong.body.error, ghost.body.error);
  const out = await api(t.base, 'POST', '/api/auth/logout', { body: {} });
  assert.match(out.headers.getSetCookie()[0], /Max-Age=0/);
  await t.close();
});

test('auth: a tampered or expired cookie is not a session', async () => {
  const t = await startApp();
  const { cookie } = await signUp(t.base, 'cookie_user');
  const [name, value] = cookie.split('=');
  const [body, sig] = value.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'someone-else', n: 'admin', e: 9999999999 })).toString('base64url');
  assert.equal((await api(t.base, 'GET', '/api/auth/me', { cookie: `${name}=${forged}.${sig}` })).body.user, null);
  assert.equal((await api(t.base, 'GET', '/api/auth/me', { cookie: `${name}=${body}.${sig.slice(0, -2)}xx` })).body.user, null);
  assert.equal((await api(t.base, 'GET', '/api/auth/me', { cookie: `${name}=garbage` })).body.user, null);
  const expired = Buffer.from(JSON.stringify({ u: 'x', n: 'x', e: 1 })).toString('base64url');
  assert.equal((await api(t.base, 'GET', '/api/auth/me', { cookie: `${name}=${expired}.anything` })).body.user, null);
  await t.close();
});

test('auth: sign-up and log-in attempts are rate limited', async () => {
  const t = await startApp();
  let last;
  for (let i = 0; i < 25; i++) last = await api(t.base, 'POST', '/api/auth/login', { body: { username: 'nobody_here', password: 'guessing again' } });
  assert.equal(last.status, 429);
  await t.close();
});

test('csrf: a write from another origin is refused, the same origin is fine', async () => {
  const t = await startApp();
  const evil = await api(t.base, 'POST', '/api/notes', { body: note, headers: { origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  const own = await api(t.base, 'POST', '/api/notes', { body: note, headers: { origin: t.base } });
  assert.equal(own.status, 201);
  assert.equal((await api(t.base, 'GET', '/api/notes', { headers: { origin: 'https://evil.example' } })).status, 200, 'reads are fine');
  await t.close();
});

test('accounts switched off (production without SESSION_SECRET): guests still post, accounts say why not', async () => {
  const t = await startApp({ config: { isProd: true, sessionSecret: '' } });
  assert.equal((await api(t.base, 'POST', '/api/auth/register', { body: { username: 'someone', password: 'long enough pw' } })).status, 503);
  assert.equal((await api(t.base, 'GET', '/api/auth/me')).body.accountsEnabled, false);
  assert.equal((await api(t.base, 'POST', '/api/notes', { body: note })).status, 201);
  const priv = await api(t.base, 'POST', '/api/notes', { body: { ...note, isPrivate: true } });
  assert.equal(priv.status, 401);
  assert.match(priv.body.error, /not set up/);
  await t.close();
});

/* ---------- private notes must never leak ---------- */

test('privacy: private notes need a login and are invisible to everyone else, everywhere', async () => {
  const t = await startApp({ adminToken: 'admin-secret' });
  const owner = await signUp(t.base, 'the_owner');
  const other = await signUp(t.base, 'someone_else');
  const secretText = 'my very private zebra thought';

  assert.equal((await api(t.base, 'POST', '/api/notes', { body: { ...note, text: secretText, isPrivate: true } })).status, 401, 'guests cannot post private');
  const made = await api(t.base, 'POST', '/api/notes', { body: { ...note, text: secretText, isPrivate: true, photo: jpegDataUrl(fakeJpeg()) }, cookie: owner.cookie });
  assert.equal(made.status, 201);
  assert.equal(made.body.deleteKey, undefined, 'signed-in notes use the account, not a delete key');
  const id = made.body.item.id;
  const everywhere = async (cookie) => ({
    one: (await api(t.base, 'GET', `/api/notes/${id}`, { cookie })).status,
    photo: (await fetch(`${t.base}/api/notes/${id}/photo`, { headers: cookie ? { cookie } : {} })).status,
    wall: (await api(t.base, 'GET', '/api/notes', { cookie })).body.total,
    search: (await api(t.base, 'GET', `/api/notes?q=${id}`, { cookie })).body.total,
    word: (await api(t.base, 'GET', '/api/notes?q=zebra', { cookie })).body.total,
    day: (await api(t.base, 'GET', '/api/notes?month=7&day=20', { cookie })).body.total,
    today: (await api(t.base, 'GET', '/api/on-this-day?month=7&day=20', { cookie })).body.total,
    mine: (await api(t.base, 'GET', '/api/my-notes', { cookie })).status,
  });

  assert.deepEqual(await everywhere(undefined), { one: 404, photo: 404, wall: 0, search: 0, word: 0, day: 0, today: 0, mine: 401 });
  assert.deepEqual(await everywhere(other.cookie), { one: 404, photo: 404, wall: 0, search: 0, word: 0, day: 0, today: 0, mine: 200 });
  const own = await everywhere(owner.cookie);
  assert.equal(own.one, 200);
  assert.equal(own.photo, 200);
  assert.equal(own.today, 1, 'the owner is reminded of their own private memory');
  assert.equal(own.wall, 0, 'but it never appears on the public wall');

  assert.equal((await api(t.base, 'GET', `/api/my-notes`, { cookie: other.cookie })).body.total, 0);
  assert.equal((await api(t.base, 'GET', `/api/my-notes`, { cookie: owner.cookie })).body.total, 1);
  assert.match((await fetch(`${t.base}/api/notes/${id}/photo`, { headers: { cookie: owner.cookie } })).headers.get('cache-control'), /private, no-store/);

  // not through the share page, moderation, or deletion either
  assert.doesNotMatch(await (await fetch(`${t.base}/n/${id}`)).text(), /zebra/);
  assert.equal((await api(t.base, 'DELETE', `/api/notes/${id}`, { cookie: other.cookie })).status, 404);
  assert.equal((await api(t.base, 'GET', '/api/admin/notes', { headers: { authorization: 'Bearer admin-secret' } })).body.total, 0);
  assert.equal((await api(t.base, 'GET', `/api/notes/${id}`, { cookie: owner.cookie })).status, 200, 'still there after all that');
  await t.close();
});

test('privacy: links are allowed in private notes but not public ones', async () => {
  const t = await startApp();
  const { cookie } = await signUp(t.base, 'linker');
  const text = 'saved this: https://example.com/article';
  assert.equal((await api(t.base, 'POST', '/api/notes', { body: { ...note, text }, cookie })).status, 400);
  assert.equal((await api(t.base, 'POST', '/api/notes', { body: { ...note, text, isPrivate: true }, cookie })).status, 201);
  await t.close();
});

test('my notes: lists public and private, supports search, filters and deleting by owner only', async () => {
  const t = await startApp();
  const a = await signUp(t.base, 'user_a');
  const b = await signUp(t.base, 'user_b');
  const mk = (cookie, body) => api(t.base, 'POST', '/api/notes', { body: { ...note, ...body }, cookie });
  const pub = (await mk(a.cookie, { text: 'A public memory of mine', date: '2024-05-01' })).body.item;
  const prv = (await mk(a.cookie, { text: 'A private memory of mine', date: '2023-05-01', isPrivate: true })).body.item;
  await mk(b.cookie, { text: 'Belongs to user b', date: '2024-05-01' });
  const mine = (await api(t.base, 'GET', '/api/my-notes', { cookie: a.cookie })).body;
  assert.equal(mine.total, 2);
  assert.ok(mine.items.every((i) => i.mine));
  assert.equal((await api(t.base, 'GET', '/api/my-notes?q=private', { cookie: a.cookie })).body.total, 1);
  assert.equal((await api(t.base, 'GET', '/api/my-notes?year=2024', { cookie: a.cookie })).body.items[0].id, pub.id);
  assert.equal((await api(t.base, 'DELETE', `/api/notes/${pub.id}`, { cookie: b.cookie })).status, 403, 'someone else cannot delete a public note');
  assert.equal((await api(t.base, 'DELETE', `/api/notes/${prv.id}`, { cookie: a.cookie })).status, 200);
  assert.equal((await api(t.base, 'GET', '/api/my-notes', { cookie: a.cookie })).body.total, 1);
  await t.close();
});
