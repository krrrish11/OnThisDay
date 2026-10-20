import { HttpError } from '../utils/httpError.js';

export const apiNotFound = (_req, _res, next) => next(new HttpError(404, 'Not found.'));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500 && !(err instanceof HttpError)) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on our side.' : err.message, ...(err.extra?.errors ? { errors: err.extra.errors } : {}) });
}
