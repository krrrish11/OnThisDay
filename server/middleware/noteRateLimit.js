import { createHmac } from 'node:crypto';
import { HttpError } from '../utils/httpError.js';

const WINDOW = 60 * 60_000;

/**
 * Posting limit kept in the database (not in process memory), so it holds across serverless instances.
 * Keys are a keyed hash of the IP address or user id, and rows delete themselves after about an hour.
 */
export function createNoteRateLimit({ rate, secret, perHour }) {
  const scramble = (v) => createHmac('sha256', secret).update(v).digest('hex').slice(0, 32);
  const opts = { limit: perHour, windowMs: WINDOW };
  const tooMany = () => new HttpError(429, `You have saved ${perHour} notes in the last hour. Please try again a little later.`);

  /** Call after validation passes. Counts one post against the IP and, if signed in, the user. */
  return async function consume(req) {
    const keys = [`ip:${scramble(req.ip || 'unknown')}`];
    if (req.user) keys.push(`u:${req.user.id}`);
    for (const k of keys) if (!(await rate.peek(k, opts)).allowed) throw tooMany();
    for (const k of keys) await rate.hit(k, opts);
  };
}
