import { HttpError } from '../utils/httpError.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard for cookie sessions. Browsers always send Origin on cross-site writes, so a write whose
 * Origin is not this site is refused. Requests with no Origin (curl, server-to-server) are not browser-driven.
 */
export function sameOrigin() {
  return (req, _res, next) => {
    if (SAFE.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    try {
      if (new URL(origin).host === req.get('host')) return next();
    } catch {
      /* fall through */
    }
    return next(new HttpError(403, 'Cross-site requests are not allowed.'));
  };
}
