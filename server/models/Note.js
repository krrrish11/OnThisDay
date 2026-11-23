import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // short public ID, e.g. K7M2QX
    text: { type: String, required: true, maxlength: 2000 },
    name: { type: String, default: '', maxlength: 40 },
    // The date the memory is about, split so "same day every year" is a plain indexed lookup.
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    day: { type: Number, required: true, min: 1, max: 31 },
    isPrivate: { type: Boolean, default: false },
    ownerId: { type: String, default: null },
    deleteKeyHash: { type: String, default: null, select: false }, // sha256 of the guest's secret key
    hasPhoto: { type: Boolean, default: false },
    photo: { type: Buffer, select: false }, // compressed JPEG; never returned by list queries
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, strict: true },
);

noteSchema.index({ id: 1 }, { unique: true });
noteSchema.index({ createdAt: -1, _id: -1 }); // the wall, newest first
noteSchema.index({ isPrivate: 1, month: 1, day: 1, year: -1 }); // "On This Day"
noteSchema.index({ ownerId: 1, createdAt: -1 }); // My notes

export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema, 'otd_notes');
