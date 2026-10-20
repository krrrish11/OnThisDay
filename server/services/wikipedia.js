import { HttpError } from '../utils/httpError.js';

const ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/all';
const TYPES = ['events', 'births', 'deaths', 'holidays'];

const isWikiHost = (host) => host === 'wikipedia.org' || host.endsWith('.wikipedia.org');
const isMediaHost = (host) => isWikiHost(host) || host === 'wikimedia.org' || host.endsWith('.wikimedia.org');

function safeUrl(value, hostOk) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && hostOk(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}

/** Keep only what the front end renders, and only URLs that point at Wikipedia / Wikimedia. */
export function slimPage(p) {
  const title = typeof p?.title === 'string' ? p.title : '';
  const page = {
    title,
    normalizedtitle: typeof p?.normalizedtitle === 'string' ? p.normalizedtitle : title,
    url: safeUrl(p?.content_urls?.desktop?.page, isWikiHost),
  };
  const thumb = safeUrl(p?.thumbnail?.source, isMediaHost);
  if (thumb) page.thumbnail = thumb;
  return page;
}

export function slim(data) {
  const out = {};
  for (const type of TYPES) {
    const list = Array.isArray(data?.[type]) ? data[type] : [];
    out[type] = list
      .filter((it) => typeof it?.text === 'string')
      .map((it) => {
        const item = { text: it.text, pages: (it.pages || []).slice(0, 3).map(slimPage).filter((p) => p.title) };
        if (Number.isInteger(it.year)) item.year = it.year;
        return item;
      });
  }
  return out;
}

/**
 * Fetches and caches Wikipedia's "On this day" feed.
 * - one network request per date per TTL, shared by every visitor
 * - concurrent requests for the same date share one in-flight fetch
 * - if Wikipedia is down, an expired cache entry is served instead of an error
 */
export function createWikipedia({ fetchImpl = fetch, ttlMs, contact, timeoutMs = 8000 }) {
  const cache = new Map(); // key -> { data, expires }
  const inflight = new Map();
  const userAgent = `OnThisDay/1.0 (${contact})`;

  async function fetchFresh(mm, dd) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${ENDPOINT}/${mm}/${dd}`, {
        signal: ctrl.signal,
        headers: { 'user-agent': userAgent, accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Wikipedia responded ${res.status}`);
      return slim(await res.json());
    } finally {
      clearTimeout(timer);
    }
  }

  async function getDay(m, d) {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const key = `${mm}-${dd}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return { data: hit.data, source: 'cache' };

    if (!inflight.has(key)) {
      inflight.set(
        key,
        fetchFresh(mm, dd)
          .then((data) => {
            cache.set(key, { data, expires: Date.now() + ttlMs });
            return data;
          })
          .finally(() => inflight.delete(key)),
      );
    }
    try {
      return { data: await inflight.get(key), source: 'wikipedia' };
    } catch (err) {
      if (hit) return { data: hit.data, source: 'stale' };
      throw new HttpError(502, 'Wikipedia is not reachable right now.', { cause: err.message });
    }
  }

  return { getDay };
}
