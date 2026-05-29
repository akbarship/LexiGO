import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, default: "#21a67a" },
    dailyGoal: { type: Number, default: 10 },
    isDefault: { type: Boolean, default: false },
    archived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

collectionSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Collection = mongoose.model("Collection", collectionSchema);
