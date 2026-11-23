import express, { Router } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../utils/httpError.js';
import { isValidMonthDay } from '../utils/dates.js';
import { newNoteId, normalizeId } from '../utils/ids.js';
import { validateNote } from '../utils/validateNote.js';
import { decodeCursor } from '../stores/cursor.js';
import { toPublicNote } from '../stores/rows.js';
import { requireUser } from '../middleware/auth.js';

const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
const sameHash = (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b));
const canSee = (row, user) => !row.isPrivate || Boolean(user && row.ownerId === user.id);

/** ?q= &month= &day= &year= &limit= &before= -> store filter. Throws 400 on nonsense. */
function parseFilters(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
  if (query.before && decodeCursor(query.before) === undefined) throw new HttpError(400, 'Invalid cursor.');
  const f = { limit, before: query.before, q: typeof query.q === 'string' ? query.q : '' };
  if (query.month || query.day) {
    f.month = Number(query.month);
    f.day = Number(query.day);
    if (!isValidMonthDay(f.month, f.day)) throw new HttpError(400, 'Choose a real month and day.');
  }
  if (query.year) {
    f.year = Number(query.year);
    if (!Number.isInteger(f.year) || f.year < 1900 || f.year > 2200) throw new HttpError(400, 'Choose a year from 1900 onwards.');
  }
  return f;
}

export function notesRouter({ store, consumeRate, sessionsEnabled }) {
  const router = Router();
  const shape = (rows, req) => rows.map((r) => toPublicNote(r, req.user?.id));

  /** Public wall: search + filters + cursor pagination, public notes only. */
  router.get('/', async (req, res, next) => {
    try {
      const { items, nextCursor, total } = await store.notes.list(parseFilters(req.query));
      res.set('Cache-Control', 'no-store');
      res.json({ items: shape(items, req), nextCursor, total });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', express.json({ limit: '700kb' }), async (req, res, next) => {
    try {
      // Hidden field real people never see. Bots fill it; they get a fake success and nothing is stored.
      if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') return res.status(201).json({ ok: true });

      const { value, errors } = validateNote(req.body);
      if (errors) throw new HttpError(400, 'Please fix the highlighted fields.', { errors });
      if (value.isPrivate && !req.user) {
        throw new HttpError(401, sessionsEnabled ? 'Log in to keep a note private.' : 'Private notes need accounts, which are not set up on this server yet.');
      }
      await consumeRate(req);

      // Guests get a secret key (shown once, kept in their browser). Signed-in users delete through their account.
      const deleteKey = req.user ? null : randomBytes(18).toString('base64url');
      let row;
      for (let attempt = 0; !row; attempt++) {
        try {
          row = await store.notes.create({
            id: newNoteId(),
            text: value.text,
            name: value.name,
            year: value.year,
            month: value.month,
            day: value.day,
            isPrivate: value.isPrivate,
            ownerId: req.user?.id ?? null,
            deleteKeyHash: deleteKey ? sha256(deleteKey) : null,
            photo: value.photo,
          });
        } catch (err) {
          if (!err.duplicateId || attempt >= 5) throw err; // a 6-character ID collided: try another
        }
      }
      res.set('Cache-Control', 'no-store');
      res.status(201).json({ ok: true, item: toPublicNote(row, req.user?.id), ...(deleteKey ? { deleteKey } : {}) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = normalizeId(req.params.id);
      const row = id && (await store.notes.getById(id));
      // A private note someone else asks for looks exactly like a note that does not exist.
      if (!row || !canSee(row, req.user)) throw new HttpError(404, 'No note with that ID.');
      res.set('Cache-Control', 'no-store');
      res.json({ item: toPublicNote(row, req.user?.id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/photo', async (req, res, next) => {
    try {
      const id = normalizeId(req.params.id);
      const photo = id && (await store.notes.getPhoto(id));
      if (!photo || !canSee(photo, req.user)) throw new HttpError(404, 'No photo.');
      res.set('Content-Type', photo.mime);
      res.set('Cache-Control', photo.isPrivate ? 'private, no-store' : 'public, max-age=3600');
      res.send(photo.buffer);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = normalizeId(req.params.id);
      const row = id && (await store.notes.getById(id));
      if (!row || !canSee(row, req.user)) throw new HttpError(404, 'No note with that ID.');
      const key = req.get('x-delete-key');
      const isOwner = Boolean(req.user && row.ownerId === req.user.id);
      const hasKey = Boolean(key && row.deleteKeyHash && sameHash(sha256(key), row.deleteKeyHash));
      if (!isOwner && !hasKey) throw new HttpError(403, 'Only the person who wrote this note can delete it.');
      await store.notes.remove(id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** GET /api/my-notes: everything the signed-in user wrote, public and private. */
export function myNotesRouter({ store }) {
  const router = Router();
  router.get('/', requireUser, async (req, res, next) => {
    try {
      const { items, nextCursor, total } = await store.notes.list({ ...parseFilters(req.query), ownerId: req.user.id });
      res.set('Cache-Control', 'no-store');
      res.json({ items: items.map((r) => toPublicNote(r, req.user.id)), nextCursor, total });
    } catch (err) {
      next(err);
    }
  });
  return router;
}

/** GET /api/on-this-day?month=&day=: notes (any year) written for this day, newest year first, grouped by year. */
export function onThisDayRouter({ store }) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getUTCMonth() + 1;
      const day = req.query.day ? Number(req.query.day) : now.getUTCDate();
      if (!isValidMonthDay(month, day)) throw new HttpError(400, 'Choose a real month and day.');
      const { items, total } = await store.notes.onThisDay({ month, day, viewerId: req.user?.id ?? null, limit: 60 });
      const groups = [];
      for (const r of items) {
        const last = groups[groups.length - 1];
        const note = toPublicNote(r, req.user?.id);
        if (last && last.year === r.year) last.items.push(note);
        else groups.push({ year: r.year, items: [note] });
      }
      res.set('Cache-Control', 'no-store');
      res.json({ month, day, total, shown: items.length, groups });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
