import express, { Router } from 'express';
import { HttpError } from '../utils/httpError.js';
import { validateVisitor } from '../utils/validateVisitor.js';
import { decodeCursor } from '../stores/cursor.js';
import { requireAdmin } from '../middleware/admin.js';
import { postLimiter } from '../middleware/rateLimit.js';

export function visitorsRouter({ store, adminToken, postsPerHour }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
      if (req.query.before && decodeCursor(req.query.before) === undefined) throw new HttpError(400, 'Invalid cursor.');
      const [page, total] = await Promise.all([store.list({ limit, before: req.query.before }), store.count()]);
      res.set('Cache-Control', 'no-store');
      res.json({ ...page, total });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', postLimiter(postsPerHour), express.json({ limit: '4kb' }), async (req, res, next) => {
    try {
      // Hidden field real people never see. Bots fill it; they get a fake success and nothing is stored.
      if (req.body && typeof req.body.website === 'string' && req.body.website.trim() !== '') {
        return res.status(201).json({ ok: true });
      }
      const { value, errors } = validateVisitor(req.body);
      if (errors) throw new HttpError(400, 'Please fix the highlighted fields.', { errors });
      res.status(201).json({ ok: true, item: await store.create(value) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAdmin(adminToken), async (req, res, next) => {
    try {
      if (!(await store.remove(req.params.id))) throw new HttpError(404, 'No such entry.');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
