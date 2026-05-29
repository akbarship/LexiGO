import { config } from "../config.js";
import { Admin, BotSetting, Collection, RequiredChannel, StudyItem, User, Word } from "../models/index.js";

const SUBSCRIPTION_CHECK_KEY = "subscription_check_enabled";

export function isBootstrapAdmin(telegramId) {
  return config.adminIds.includes(Number(telegramId));
}

export async function isAdmin(telegramId) {
  const id = Number(telegramId);
  if (isBootstrapAdmin(id)) return true;
  return Boolean(await Admin.exists({ telegramId: id, active: true }));
}

export async function listAdmins() {
  return Admin.find({ active: true }).sort({ createdAt: 1 });
}

export async function addAdmin({ telegramId, name, addedBy }) {
  return Admin.findOneAndUpdate(
    { telegramId: Number(telegramId) },
    {
      $set: {
        name: String(name || "Admin").trim().slice(0, 80),
        addedBy,
        active: true
      }
    },
    { returnDocument: "after", upsert: true }
  );
}

export async function removeAdmin(telegramId) {
  if (isBootstrapAdmin(telegramId)) {
    return { removed: false, reason: "bootstrap" };
  }
  const result = await Admin.updateOne({ telegramId: Number(telegramId) }, { $set: { active: false } });
  return { removed: result.modifiedCount > 0 };
}

export async function getSubscriptionCheckEnabled() {
  const setting = await BotSetting.findOne({ key: SUBSCRIPTION_CHECK_KEY });
  return setting?.value !== false;
}

export async function setSubscriptionCheckEnabled(enabled) {
  await BotSetting.findOneAndUpdate(
    { key: SUBSCRIPTION_CHECK_KEY },
    { $set: { value: Boolean(enabled) } },
    { upsert: true, returnDocument: "after" }
  );
}

export async function listRequiredChannels({ activeOnly = false } = {}) {
  const query = activeOnly ? { active: true } : {};
  return RequiredChannel.find(query).sort({ createdAt: 1 });
}

export async function addRequiredChannel({ name, chatId, addedBy }) {
  const normalized = normalizeChannelInput(chatId);
  return RequiredChannel.findOneAndUpdate(
    { chatId: normalized.chatId },
    {
      $set: {
        name: String(name || normalized.username || normalized.chatId).trim().slice(0, 80),
        username: normalized.username,
        addedBy,
        active: true
      }
    },
    { returnDocument: "after", upsert: true }
  );
}

export async function removeRequiredChannel(id) {
  const result = await RequiredChannel.updateOne({ _id: id }, { $set: { active: false } });
  return result.modifiedCount > 0;
}

export async function getAdminStats() {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [users, activeUsers, inactiveUsers, newToday, words, collections, studyItems, dueItems, masteredItems, admins, channels, subscriptionEnabled] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ active: true }),
    User.countDocuments({ active: false }),
    User.countDocuments({ createdAt: { $gte: dayStart } }),
    Word.countDocuments(),
    Collection.countDocuments({ archived: false }),
    StudyItem.countDocuments(),
    StudyItem.countDocuments({ dueAt: { $lte: now }, state: { $ne: "mastered" } }),
    StudyItem.countDocuments({ state: "mastered" }),
    Admin.countDocuments({ active: true }),
    RequiredChannel.countDocuments({ active: true }),
    getSubscriptionCheckEnabled()
  ]);

  return {
    users,
    activeUsers,
    inactiveUsers,
    newToday,
    words,
    collections,
    studyItems,
    dueItems,
    masteredItems,
    admins: admins + config.adminIds.length,
    channels,
    subscriptionEnabled
  };
}

export async function getBroadcastUsers() {
  return User.find({ active: true }).select("telegramId firstName username").sort({ createdAt: 1 });
}

export async function markUserActive(telegramId, active) {
  await User.updateOne({ telegramId: Number(telegramId) }, { $set: { active: Boolean(active) } });
}

function normalizeChannelInput(value) {
  const raw = String(value || "").trim();
  const username = raw
    .replace("https://t.me/", "")
    .replace("http://t.me/", "")
    .replace("t.me/", "")
    .replace("@", "")
    .trim();

  if (username && !username.startsWith("-100") && !/^-?\d+$/.test(username)) {
    return { chatId: `@${username}`, username };
  }

  return { chatId: raw.startsWith("@") ? raw : username || raw, username: raw.startsWith("@") ? raw.slice(1) : null };
}
