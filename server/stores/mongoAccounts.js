import mongoose from 'mongoose';
import { decodeCursor } from './cursor.js';
import { noteCursor } from './rows.js';
import { buildSearch, escapeRegExp } from './search.js';
import { Note } from '../models/Note.js';
import { User } from '../models/User.js';
import { RateHit } from '../models/RateHit.js';

const isDup = (err) => err?.code === 11000;

/** Row shape shared with the memory store. Photo bytes and the delete-key hash never ride along on list queries. */
const toRow = (d) => ({
  _id: String(d._id),
  id: d.id,
  text: d.text,
  name: d.name,
  year: d.year,
  month: d.month,
  day: d.day,
  isPrivate: d.isPrivate,
  ownerId: d.ownerId,
  hasPhoto: d.hasPhoto,
  createdAt: d.createdAt,
  ...(d.deleteKeyHash !== undefined ? { deleteKeyHash: d.deleteKeyHash } : {}),
});

function searchClause(q) {
  const s = buildSearch(q);
  if (!s) return null;
  const words = { $and: s.words.map((w) => { const re = new RegExp(escapeRegExp(w), 'i'); return { $or: [{ text: re }, { name: re }] }; }) };
  return s.id ? { $or: [{ id: s.id }, words] } : words;
}

function filterClauses({ q, month, day, year, ownerId }) {
  const c = [ownerId ? { ownerId } : { isPrivate: false }];
  if (month) c.push({ month, day });
  if (year) c.push({ year });
  const s = searchClause(q);
  if (s) c.push(s);
  return c;
}

export function createMongoNotes() {
  return {
    async create(doc) {
      const { photo, ...rest } = doc;
      try {
        const saved = await Note.create({ ...rest, hasPhoto: Boolean(photo), photo: photo ? photo.buffer : undefined });
        return toRow(saved.toObject());
      } catch (err) {
        if (isDup(err)) throw Object.assign(new Error('duplicate id'), { duplicateId: true });
        throw err;
      }
    },
    async getById(id) {
      const d = await Note.findOne({ id }).select('+deleteKeyHash').lean();
      return d ? toRow(d) : null;
    },
    async getPhoto(id) {
      const d = await Note.findOne({ id, hasPhoto: true }).select('+photo ownerId isPrivate'); // hydrated, so photo is a real Buffer
      return d?.photo ? { buffer: Buffer.from(d.photo), mime: 'image/jpeg', ownerId: d.ownerId, isPrivate: d.isPrivate } : null;
    },
    async list({ q, month, day, year, ownerId, limit, before }) {
      const base = filterClauses({ q, month, day, year, ownerId });
      const cur = decodeCursor(before);
      const clauses = [...base];
      if (cur) {
        const at = new Date(cur.ms);
        clauses.push({ $or: [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: new mongoose.Types.ObjectId(cur.id) } }] });
      }
      const [rows, total] = await Promise.all([
        Note.find({ $and: clauses }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
        Note.countDocuments({ $and: base }),
      ]);
      const items = rows.slice(0, limit).map(toRow);
      return { items, nextCursor: rows.length > limit ? noteCursor(items[items.length - 1]) : null, total };
    },
    async onThisDay({ month, day, viewerId, limit }) {
      const visible = viewerId ? { $or: [{ isPrivate: false }, { ownerId: viewerId }] } : { isPrivate: false };
      const filter = { $and: [{ month, day }, visible] };
      const [rows, total] = await Promise.all([
        Note.find(filter).sort({ year: -1, createdAt: -1 }).limit(limit).lean(),
        Note.countDocuments(filter),
      ]);
      return { items: rows.map(toRow), total };
    },
    async remove(id) {
      return Boolean((await Note.deleteOne({ id })).deletedCount);
    },
  };
}

export function createMongoUsers() {
  const view = (u) => ({ id: String(u._id), username: u.username, passwordHash: u.passwordHash });
  return {
    async create({ username, passwordHash }) {
      try {
        return view(await User.create({ username, passwordHash }));
      } catch (err) {
        if (isDup(err)) throw Object.assign(new Error('duplicate username'), { duplicateUsername: true });
        throw err;
      }
    },
    async findByUsername(username) {
      const u = await User.findOne({ username }).select('+passwordHash').lean();
      return u ? view(u) : null;
    },
    async findById(id) {
      if (!/^[0-9a-f]{24}$/.test(id)) return null;
      const u = await User.findById(id).lean();
      return u ? view(u) : null;
    },
  };
}

export function createMongoRate() {
  return {
    async hit(key, { limit, windowMs }) {
      const since = new Date(Date.now() - windowMs);
      if ((await RateHit.countDocuments({ key, at: { $gte: since } })) >= limit) return { allowed: false };
      await RateHit.create({ key });
      return { allowed: true };
    },
    async peek(key, { limit, windowMs }) {
      const since = new Date(Date.now() - windowMs);
      return { allowed: (await RateHit.countDocuments({ key, at: { $gte: since } })) < limit };
    },
  };
}
