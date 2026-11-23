import { createHmac, timingSafeEqual } from 'node:crypto';

const DAY = 86_400;

/**
 * Stateless sessions: an HMAC-signed, httpOnly cookie. Nothing to store, so it works on serverless.
 * Trade-off: logging out clears the cookie but cannot revoke a copy someone already stole before it expires.
 */
export function createSessions({ secret, secure, maxAgeDays = 30 }) {
  const name = secure ? '__Host-otd' : 'otd'; // __Host- pins the cookie to this exact origin over HTTPS
  const sign = (data) => createHmac('sha256', secret).update(data).digest('base64url');
  const maxAge = maxAgeDays * DAY;
  const attrs = `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

  return {
    issue(res, user) {
      const body = Buffer.from(JSON.stringify({ u: user.id, n: user.username, e: Math.floor(Date.now() / 1000) + maxAge })).toString('base64url');
      res.append('Set-Cookie', `${name}=${body}.${sign(body)}; ${attrs}; Max-Age=${maxAge}`);
    },
    clear(res) {
      res.append('Set-Cookie', `${name}=; ${attrs}; Max-Age=0`);
    },
    read(req) {
      const raw = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
      if (!raw) return null;
      const [body, sig] = raw.slice(name.length + 1).split('.');
      if (!body || !sig) return null;
      const want = Buffer.from(sign(body));
      const got = Buffer.from(sig);
      if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
      try {
        const p = JSON.parse(Buffer.from(body, 'base64url').toString());
        return p.e > Date.now() / 1000 && typeof p.u === 'string' ? { id: p.u, username: String(p.n) } : null;
      } catch {
        return null;
      }
    },
  };
}
