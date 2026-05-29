import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    addedBy: Number,
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Admin = mongoose.model("Admin", adminSchema);
