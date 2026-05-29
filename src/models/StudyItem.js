import mongoose from "mongoose";

const studyItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Collection", required: true, index: true },
    wordId: { type: mongoose.Schema.Types.ObjectId, ref: "Word", required: true, index: true },
    state: { type: String, enum: ["learning", "review", "retention", "mastered"], default: "learning" },
    step: { type: Number, default: 0 },
    intervalDays: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },
    repetitionCount: { type: Number, default: 0 },
    dueAt: { type: Date, default: Date.now, index: true },
    masteredAt: Date,
    lastReviewedAt: Date,
    lastGrade: String,
    lastQuality: Number,
    reviews: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    correctStreak: { type: Number, default: 0 }
  },
  { timestamps: true }
);

studyItemSchema.index({ userId: 1, collectionId: 1, wordId: 1 }, { unique: true });

export const StudyItem = mongoose.model("StudyItem", studyItemSchema);
