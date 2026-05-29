import { Collection, StudyItem, User } from "../models/index.js";
import { touchStudyStreak } from "./users.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_AS_DAYS = 1 / (24 * 60);
const XP_PER_CORRECT = 20;
const XP_BY_GRADE = {
  again: 0,
  hard: 8,
  good: XP_PER_CORRECT,
  easy: 24
};
const SESSION_LIMIT = 10;
const QUALITY_BY_GRADE = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5
};

export async function getDashboard(userId) {
  const user = await User.findById(userId);
  const collections = await Collection.find({ userId, archived: false }).sort({ createdAt: 1 });
  const rows = await Promise.all(collections.map(async (collection) => {
    const [total, mastered, due, nextDue] = await Promise.all([
      StudyItem.countDocuments({ collectionId: collection._id }),
      StudyItem.countDocuments({ collectionId: collection._id, state: "mastered" }),
      StudyItem.countDocuments({
        collectionId: collection._id,
        dueAt: { $lte: new Date() },
        state: { $ne: "mastered" }
      }),
      StudyItem.findOne({
        collectionId: collection._id,
        dueAt: { $lte: new Date() },
        state: { $ne: "mastered" }
      }).populate("wordId").sort({ dueAt: 1 })
    ]);

    return {
      id: collection._id,
      name: collection.name,
      color: collection.color,
      dailyGoal: collection.dailyGoal,
      isDefault: isDefaultCollection(collection),
      total,
      mastered,
      due,
      preview: nextDue?.wordId
        ? {
            word: nextDue.wordId.word,
            pronunciation: nextDue.wordId.pronunciation,
            level: nextDue.wordId.level
          }
        : null
    };
  }));

  return {
    user: {
      telegramId: user.telegramId,
      xp: user.xp,
      level: user.level,
      streak: user.streak
    },
    collections: rows
  };
}

function isDefaultCollection(collection) {
  return collection.isDefault || collection.name === "My Vocabulary";
}

export async function getSession(userId, collectionIds) {
  const ids = Array.isArray(collectionIds) ? collectionIds : [collectionIds];
  return StudyItem.find({
    userId,
    collectionId: { $in: ids },
    dueAt: { $lte: new Date() },
    state: { $ne: "mastered" }
  })
    .populate("wordId")
    .sort({ dueAt: 1 })
    .limit(SESSION_LIMIT);
}

export async function gradeItem(userId, itemId, grade) {
  const item = await StudyItem.findOne({ _id: itemId, userId }).populate("wordId");
  if (!item) return null;

  const normalizedGrade = normalizeGrade(grade);
  const quality = QUALITY_BY_GRADE[normalizedGrade];
  const scheduled = scheduleReview(
    {
      interval: item.intervalDays,
      ease_factor: item.easeFactor,
      repetition_count: item.repetitionCount,
      lapses: item.lapses
    },
    quality
  );

  item.reviews += 1;
  item.state = scheduled.status;
  item.intervalDays = scheduled.interval;
  item.easeFactor = scheduled.ease_factor;
  item.repetitionCount = scheduled.repetition_count;
  item.lapses = scheduled.lapses;
  item.lastReviewedAt = scheduled.last_reviewed_at;
  item.lastGrade = normalizedGrade;
  item.lastQuality = scheduled.last_quality;
  item.dueAt = scheduled.next_review_at;
  item.correctStreak = quality < 3 ? 0 : item.correctStreak + 1;
  item.masteredAt = scheduled.status === "mastered" && !item.masteredAt ? scheduled.last_reviewed_at : item.masteredAt;

  await item.save();

  const xp = XP_BY_GRADE[normalizedGrade];
  const user = await User.findById(userId);
  user.xp += xp;
  user.level = Math.floor(user.xp / 1000) + 1;
  await touchStudyStreak(user);

  return {
    item,
    xp,
    mastered: scheduled.status === "mastered",
    repeatNow: normalizedGrade === "again",
    nextDueAt: item.dueAt
  };
}

function normalizeGrade(grade) {
  return ["again", "hard", "good", "easy"].includes(grade) ? grade : "good";
}

function clampEase(ease) {
  return Math.max(1.3, Math.round(ease * 100) / 100);
}

function roundInterval(interval) {
  if (interval < 1) return Math.round(interval * 10000) / 10000;
  return Math.max(1, Math.round(interval));
}

export function scheduleReview(progress, quality, reviewedAt = new Date()) {
  const normalizedQuality = Number(quality);

  if (!Number.isInteger(normalizedQuality) || normalizedQuality < 0 || normalizedQuality > 5) {
    throw new Error("Quality must be an integer from 0 to 5");
  }

  let interval = progress.interval || 0;
  let easeFactor = progress.ease_factor || 2.5;
  let repetitionCount = progress.repetition_count || 0;
  let lapses = progress.lapses || 0;

  if (normalizedQuality < 3) {
    repetitionCount = 0;
    lapses += 1;
    interval = 10 * MINUTE_AS_DAYS;
    easeFactor = clampEase(easeFactor - 0.2);
  } else {
    easeFactor = clampEase(
      easeFactor + (0.1 - (5 - normalizedQuality) * (0.08 + (5 - normalizedQuality) * 0.02))
    );

    if (repetitionCount === 0) {
      interval = normalizedQuality === 3 ? 0.5 : 1;
    } else if (repetitionCount === 1) {
      interval = normalizedQuality === 3 ? 2 : 3;
    } else {
      const qualityMultiplier = normalizedQuality === 3 ? 0.7 : normalizedQuality === 4 ? 1 : 1.3;
      interval = Math.max(1, interval * easeFactor * qualityMultiplier);
    }

    repetitionCount += 1;
    interval = roundInterval(interval);
  }

  const status = repetitionCount >= 5 && interval >= 30
    ? "mastered"
    : repetitionCount >= 2
      ? "retention"
      : "learning";

  return {
    status,
    interval,
    ease_factor: easeFactor,
    repetition_count: repetitionCount,
    lapses,
    last_quality: normalizedQuality,
    last_reviewed_at: reviewedAt,
    next_review_at: new Date(reviewedAt.getTime() + interval * DAY_MS)
  };
}
