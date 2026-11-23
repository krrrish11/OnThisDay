import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false, strict: true },
);
userSchema.index({ username: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema, 'otd_users');
