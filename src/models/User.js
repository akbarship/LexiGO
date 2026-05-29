import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    firstName: String,
    username: String,
    active: { type: Boolean, default: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: {
      current: { type: Number, default: 0 },
      best: { type: Number, default: 0 },
      lastStudiedAt: Date
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
