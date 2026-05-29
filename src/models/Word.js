import mongoose from "mongoose";

const wordSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    word: { type: String, required: true },
    level: String,
    importanceRate: Number,
    definition: { type: String, required: true },
    example: String,
    uzbekMeaning: String,
    pronunciation: String,
    synonyms: [String],
    hint: String
  },
  { timestamps: true }
);

export const Word = mongoose.model("Word", wordSchema);
