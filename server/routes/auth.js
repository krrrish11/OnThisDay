import express, { Router } from 'express';
import { HttpError } from '../utils/httpError.js';
import { validateCredentials } from '../utils/validateAuth.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { attemptLimiter } from '../middleware/rateLimit.js';

const publicUser = (u) => ({ id: u.id, username: u.username });

export function authRouter({ store, sessions }) {
  const router = Router();
  const json = express.json({ limit: '2kb' });
  const off = (_req, _res, next) => next(new HttpError(503, 'Accounts are not set up on this server yet. You can still post public notes.'));
  const gate = sessions ? (_req, _res, next) => next() : off;

  const registerLimit = attemptLimiter({ windowMs: 60 * 60_000, limit: 8, message: 'Too many sign-ups from this network. Please try again later.' });
  const loginLimit = attemptLimiter({ windowMs: 15 * 60_000, limit: 20, message: 'Too many log-in attempts. Please wait a few minutes.' });

  router.post('/register', gate, registerLimit, json, async (req, res, next) => {
    try {
      const { value, errors } = validateCredentials(req.body, { forRegister: true });
      if (errors) throw new HttpError(400, 'Please fix the highlighted fields.', { errors });
      let user;
      try {
        user = await store.users.create({ username: value.username, passwordHash: await hashPassword(value.password) });
      } catch (err) {
        if (err.duplicateUsername) throw new HttpError(409, 'That username is taken.', { errors: { username: 'That username is taken.' } });
        throw err;
      }
      sessions.issue(res, user);
      res.status(201).json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', gate, loginLimit, json, async (req, res, next) => {
    try {
      const { value, errors } = validateCredentials(req.body, { forRegister: false });
      if (errors) throw new HttpError(400, 'Enter your username and password.', { errors });
      const user = await store.users.findByUsername(value.username);
      if (!(await verifyPassword(value.password, user?.passwordHash))) throw new HttpError(401, 'Wrong username or password.');
      sessions.issue(res, user);
      res.json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (req, res) => {
    sessions?.clear(res);
    res.json({ ok: true });
  });

  router.get('/me', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      if (!req.user) return res.json({ user: null, accountsEnabled: Boolean(sessions) });
      const user = await store.users.findById(req.user.id);
      if (!user) {
        sessions.clear(res); // the account no longer exists
        return res.json({ user: null, accountsEnabled: true });
      }
      res.json({ user: publicUser(user), accountsEnabled: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
