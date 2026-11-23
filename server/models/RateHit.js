import mongoose from 'mongoose';

// One row per accepted post, keyed by a scrambled IP or user ID. MongoDB deletes rows itself after an hour (TTL).
const rateHitSchema = new mongoose.Schema({ key: { type: String, required: true }, at: { type: Date, default: Date.now } }, { versionKey: false });
rateHitSchema.index({ key: 1, at: -1 });
rateHitSchema.index({ at: 1 }, { expireAfterSeconds: 3700 });

export const RateHit = mongoose.models.RateHit || mongoose.model('RateHit', rateHitSchema);
