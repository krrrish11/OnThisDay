import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    place: { type: String, trim: true, maxlength: 80, default: '' },
    message: { type: String, required: true, trim: true, minlength: 5, maxlength: 280 },
    favDate: {
      type: new mongoose.Schema({ m: { type: Number, min: 1, max: 12 }, d: { type: Number, min: 1, max: 31 } }, { _id: false }),
      default: null,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, strict: true },
);

// The wall is always read newest-first; _id breaks ties between same-millisecond posts.
visitorSchema.index({ createdAt: -1, _id: -1 });

export const Visitor = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);
