import { Collection, User } from "../models/index.js";

export async function ensureUser(from) {
  const telegramId = Number(from.id || from);
  const update = typeof from === "object"
    ? {
        firstName: from.first_name,
        username: from.username,
        active: true
      }
    : { active: true };

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: update, $setOnInsert: { telegramId } },
    { returnDocument: "after", upsert: true }
  );

  await ensureDefaultCollection(user._id);
  return user;
}

export async function ensureDefaultCollection(userId) {
  return Collection.findOneAndUpdate(
    { userId, name: "My Vocabulary" },
    {
      $set: { isDefault: true },
      $setOnInsert: { userId, name: "My Vocabulary", color: "#21a67a", dailyGoal: 10 }
    },
    { returnDocument: "after", upsert: true }
  );
}

export async function touchStudyStreak(user) {
  const now = new Date();
  const last = user.streak?.lastStudiedAt;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);

  if (!last || last < startYesterday) {
    user.streak.current = 1;
  } else if (last < startToday) {
    user.streak.current += 1;
  }

  user.streak.best = Math.max(user.streak.best || 0, user.streak.current || 1);
  user.streak.lastStudiedAt = now;
  await user.save();
}
