import { request } from '../api/http.js';

let pending = null;

/** Who is signed in. One request per page, shared by everything that asks. */
export function loadSession() {
  pending ??= request('/api/auth/me').catch(() => ({ user: null, accountsEnabled: false }));
  return pending;
}

export function forgetSession() {
  pending = null;
}

/** Only allow redirects to a path on this site ("/wall"), never to another origin ("//evil.example"). */
export function safeNext(raw, fallback = '/') {
  return typeof raw === 'string' && /^\/(?![/\\])/.test(raw) ? raw : fallback;
}
