import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../utils/httpError.js';

const digest = (s) => createHash('sha256').update(String(s)).digest();

/** Bearer-token gate for moderation. With no ADMIN_TOKEN set the endpoint does not exist. */
export function requireAdmin(token) {
  return (req, _res, next) => {
    if (!token) return next(new HttpError(404, 'Not found.'));
    const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    return timingSafeEqual(digest(given), digest(token)) ? next() : next(new HttpError(401, 'Unauthorized.'));
  };
}
