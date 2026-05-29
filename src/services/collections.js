import { Collection, StudyItem } from "../models/index.js";
import { ensureDefaultCollection } from "./users.js";

const palette = ["#21a67a", "#6d64d8", "#5e8c31", "#c77912", "#0f8b8d"];

export async function listCollections(userId) {
  const items = await Collection.find({ userId, archived: false }).sort({ createdAt: 1 });
  if (items.length) return items;
  return [await ensureDefaultCollection(userId)];
}

export async function createCollection(userId, name) {
  const count = await Collection.countDocuments({ userId });
  return Collection.create({
    userId,
    name: String(name || "New Collection").trim().slice(0, 40),
    color: palette[count % palette.length],
    dailyGoal: 10,
    isDefault: false
  });
}

export async function addWordToCollection(userId, collectionId, wordId) {
  const existing = await StudyItem.findOne({ userId, collectionId, wordId });
  if (existing) return { item: existing, created: false };

  const item = await StudyItem.create({
    userId,
    collectionId,
    wordId,
    state: "learning",
    dueAt: new Date()
  });

  return { item, created: true };
}

export async function getCollectionIdsForWord(userId, wordId) {
  const items = await StudyItem.find({ userId, wordId }).select("collectionId");
  return new Set(items.map((item) => item.collectionId.toString()));
}

export async function collectionProgress(collectionId) {
  const [total, mastered, due] = await Promise.all([
    StudyItem.countDocuments({ collectionId }),
    StudyItem.countDocuments({ collectionId, state: "mastered" }),
    StudyItem.countDocuments({ collectionId, dueAt: { $lte: new Date() }, state: { $ne: "mastered" } })
  ]);
  return { total, mastered, due };
}
