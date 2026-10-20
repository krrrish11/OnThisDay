import rateLimit from 'express-rate-limit';

const json = (message) => (_req, res) => res.status(429).json({ error: message });

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json('Too many requests. Please slow down.'),
});

export const postLimiter = (limit) =>
  rateLimit({
    windowMs: 60 * 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: json('You have posted a few times already. Please try again in an hour.'),
  });
