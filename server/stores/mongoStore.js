import mongoose from 'mongoose';
import { Visitor } from '../models/Visitor.js';
import { decodeCursor, encodeCursor, toPublic } from './cursor.js';

export async function createMongoStore(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  return {
    kind: 'mongodb',
    async list({ limit, before }) {
      const query = {};
      const cur = decodeCursor(before);
      if (cur) {
        const at = new Date(cur.ms);
        const id = new mongoose.Types.ObjectId(cur.id);
        query.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: id } }];
      }
      const rows = await Visitor.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
      const items = rows.slice(0, limit).map(toPublic);
      return { items, nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null };
    },
    count: () => Visitor.estimatedDocumentCount(),
    async create(value) {
      return toPublic(await Visitor.create(value));
    },
    async remove(id) {
      if (!mongoose.isValidObjectId(id)) return false;
      return Boolean(await Visitor.findByIdAndDelete(id));
    },
    ping: () => mongoose.connection.readyState === 1,
    close: () => mongoose.disconnect(),
  };
}
