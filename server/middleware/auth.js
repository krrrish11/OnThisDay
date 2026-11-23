import { HttpError } from '../utils/httpError.js';

/** Puts the signed-in user (or null) on req.user. Accounts being off is simply "nobody is signed in". */
export const attachUser = (sessions) => (req, _res, next) => {
  req.user = sessions ? sessions.read(req) : null;
  next();
};

export const requireUser = (req, _res, next) => (req.user ? next() : next(new HttpError(401, 'Please log in first.')));
