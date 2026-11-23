import { Router } from 'express';
import { HttpError } from '../utils/httpError.js';
import { normalizeId } from '../utils/ids.js';
import { decodeCursor } from '../stores/cursor.js';
import { toPublicNote } from '../stores/rows.js';
import { requireAdmin } from '../middleware/admin.js';

/** Moderation. Lists public notes only: private notes stay private even from the admin. */
export function adminRouter({ store, adminToken }) {
  const router = Router();
  router.use(requireAdmin(adminToken));

  router.get('/ping', (_req, res) => res.json({ ok: true }));

  router.get('/notes', async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
      if (req.query.before && decodeCursor(req.query.before) === undefined) throw new HttpError(400, 'Invalid cursor.');
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const { items, nextCursor, total } = await store.notes.list({ q, limit, before: req.query.before });
      res.set('Cache-Control', 'no-store');
      res.json({ items: items.map((r) => toPublicNote(r)), nextCursor, total });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/notes/:id', async (req, res, next) => {
    try {
      const id = normalizeId(req.params.id);
      if (!id || !(await store.notes.remove(id))) throw new HttpError(404, 'No note with that ID.');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
