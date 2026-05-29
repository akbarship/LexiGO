import { Bot, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { getOrCreateWord } from "../services/dictionary.js";
import { addWordToCollection, collectionProgress, getCollectionIdsForWord, listCollections } from "../services/collections.js";
import { ensureUser } from "../services/users.js";
import {
  addAdmin,
  addRequiredChannel,
  getAdminStats,
  getBroadcastUsers,
  getSubscriptionCheckEnabled,
  isAdmin,
  isBootstrapAdmin,
  listAdmins,
  listRequiredChannels,
  markUserActive,
  removeAdmin,
  removeRequiredChannel,
  setSubscriptionCheckEnabled
} from "../services/admin.js";
import {
  collectionsKeyboard,
  mainMenuKeyboard,
  savedKeyboard,
  subscribeKeyboard,
  wordKeyboard
} from "./keyboards.js";

export function createBot() {
  const bot = new Bot(config.botToken);
  const menuMessages = new Map();
  const adminStates = new Map();
  const broadcastDrafts = new Map();

  bot.command("admin", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    await ctx.reply("🛠 <b>LexiGO admin</b>\n\nChoose what you want to manage:", {
      parse_mode: "HTML",
      reply_markup: adminPanelKeyboard()
    });
  });

  bot.command("start", async (ctx) => {
    const user = await ensureUser(ctx.from);
    const missingChannels = await getMissingRequiredChannels(ctx);
    if (missingChannels.length) {
      await ctx.reply("👋 Welcome to LexiGO.\n\n📢 Join these channels first to use the bot:", {
        reply_markup: subscribeKeyboard(missingChannels)
      });
      return;
    }

    await sendCleanMenu(ctx, menuMessages,
      user.createdAt?.getTime() === user.updatedAt?.getTime()
        ? "🚀 LexiGO helps you catch useful words instantly, then master them in short web sessions.\n\n✍️ Send any English word to begin."
        : "👋 Send me a word to define it, or jump back into practice 🧠",
      { reply_markup: mainMenuKeyboard() }
    );
  });

  bot.callbackQuery("check_subscription", async (ctx) => {
    const missingChannels = await getMissingRequiredChannels(ctx);
    if (!missingChannels.length) {
      await ensureUser(ctx.from);
      await ctx.editMessageText("✅ Thanks! Send any English word to begin ✍️", {
        reply_markup: mainMenuKeyboard()
      });
    } else {
      await ctx.answerCallbackQuery({ text: "❌ You have not subscribed yet.", show_alert: true });
    }
  });

  bot.callbackQuery("admin:panel", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("🛠 <b>LexiGO admin</b>\n\nChoose what you want to manage:", {
      parse_mode: "HTML",
      reply_markup: adminPanelKeyboard()
    });
  });

  bot.callbackQuery("admin:stats", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(await formatAdminStats(), {
      parse_mode: "HTML",
      reply_markup: adminBackKeyboard()
    });
  });

  bot.callbackQuery("admin:sending", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    adminStates.set(ctx.from.id, { type: "broadcast_wait_content" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "📣 <b>Broadcast</b>\n\nSend me the message/media you want to forward to all active users.\n\nI will show a confirmation before sending.",
      {
        parse_mode: "HTML",
        reply_markup: adminCancelKeyboard()
      }
    );
  });

  bot.callbackQuery(/^admin:broadcast:(confirm|cancel)$/, async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    const action = ctx.match[1];
    const draft = broadcastDrafts.get(ctx.from.id);

    if (action === "cancel") {
      broadcastDrafts.delete(ctx.from.id);
      adminStates.delete(ctx.from.id);
      await ctx.answerCallbackQuery({ text: "Broadcast cancelled." });
      await ctx.editMessageText("🛠 <b>LexiGO admin</b>\n\nChoose what you want to manage:", {
        parse_mode: "HTML",
        reply_markup: adminPanelKeyboard()
      });
      return;
    }

    if (!draft) {
      await ctx.answerCallbackQuery({ text: "No broadcast draft found.", show_alert: true });
      return;
    }

    broadcastDrafts.delete(ctx.from.id);
    adminStates.delete(ctx.from.id);
    await ctx.answerCallbackQuery();
    const statusMessageId = ctx.callbackQuery.message.message_id;
    await ctx.editMessageText("📣 Broadcast started...\n\nSent: 0\nFailed: 0\nBlocked: 0");
    await runBroadcast(ctx, draft, statusMessageId);
  });

  bot.callbackQuery("admin:admins", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    await showAdminsPanel(ctx);
  });

  bot.callbackQuery("admin:add_admin", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    adminStates.set(ctx.from.id, { type: "admin_add_name" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("👤 Send the admin name.", {
      reply_markup: adminCancelKeyboard()
    });
  });

  bot.callbackQuery(/^admin:remove_admin:(\d+)$/, async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    const telegramId = Number(ctx.match[1]);
    const result = await removeAdmin(telegramId);
    await ctx.answerCallbackQuery({
      text: result.reason === "bootstrap" ? "This admin comes from .env and cannot be removed here." : "Admin removed."
    });
    await showAdminsPanel(ctx);
  });

  bot.callbackQuery("admin:channels", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    await showChannelsPanel(ctx);
  });

  bot.callbackQuery("admin:add_channel", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    adminStates.set(ctx.from.id, { type: "channel_add_name" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("📢 Send the channel display name.", {
      reply_markup: adminCancelKeyboard()
    });
  });

  bot.callbackQuery(/^admin:remove_channel:(.+)$/, async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    await removeRequiredChannel(ctx.match[1]);
    await ctx.answerCallbackQuery({ text: "Channel removed." });
    await showChannelsPanel(ctx);
  });

  bot.callbackQuery("admin:toggle_channels", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    const enabled = await getSubscriptionCheckEnabled();
    await setSubscriptionCheckEnabled(!enabled);
    await ctx.answerCallbackQuery({ text: !enabled ? "Subscription check enabled." : "Subscription check disabled." });
    await showChannelsPanel(ctx);
  });

  bot.callbackQuery("admin:cancel", async (ctx) => {
    if (!(await guardAdmin(ctx))) return;
    adminStates.delete(ctx.from.id);
    broadcastDrafts.delete(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "Cancelled." });
    await ctx.editMessageText("🛠 <b>LexiGO admin</b>\n\nChoose what you want to manage:", {
      parse_mode: "HTML",
      reply_markup: adminPanelKeyboard()
    });
  });

  bot.callbackQuery("groups", async (ctx) => {
    const user = await ensureUser(ctx.from);
    const collections = await listCollections(user._id);
    const rows = await Promise.all(collections.map(async (collection) => {
      const progress = await collectionProgress(collection._id);
      return { collection, progress };
    }));
    await ctx.answerCallbackQuery();
    await deleteCurrentMessage(ctx);
    await sendCleanMenu(ctx, menuMessages, formatCollectionsMessage(rows), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard()
    });
  });

  bot.callbackQuery(/^save:(.+)$/, async (ctx) => {
    const user = await ensureUser(ctx.from);
    const collections = await listCollections(user._id);
    const savedCollectionIds = await getCollectionIdsForWord(user._id, ctx.match[1]);
    const wordId = ctx.match[1];
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: collectionsKeyboard(wordId, collections, savedCollectionIds)
    });
  });

  bot.callbackQuery(/^add:([^:]+):([^:]+)$/, async (ctx) => {
    const user = await ensureUser(ctx.from);
    const [, wordId, collectionId] = ctx.match;
    const { created } = await addWordToCollection(user._id, collectionId, wordId);
    await ctx.answerCallbackQuery({
      text: created ? "✅ Saved." : "⚠️ Already saved in this collection."
    });
    await ctx.editMessageReplyMarkup({ reply_markup: savedKeyboard() });
  });

  bot.callbackQuery(/^noop:/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ Already saved in this collection." });
  });

  bot.callbackQuery("keep_exploring", async (ctx) => {
    await ctx.answerCallbackQuery();
    await deleteCurrentMessage(ctx);
    await sendCleanMenu(ctx, menuMessages, "🔎 Send another English word and I’ll define it for you.", {
      reply_markup: mainMenuKeyboard()
    });
  });

  bot.on("message", async (ctx, next) => {
    if (await handleAdminState(ctx, adminStates, broadcastDrafts)) return;
    return next();
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    await ensureUser(ctx.from);
    const missingChannels = await getMissingRequiredChannels(ctx);
    if (missingChannels.length) {
      await ctx.reply("📢 Join these channels to use LexiGO:", { reply_markup: subscribeKeyboard(missingChannels) });
      return;
    }

    const waiting = await ctx.reply("🔍 Searching...");
    const word = await getOrCreateWord(text);
    if (!word) {
      await ctx.api.editMessageText(ctx.chat.id, waiting.message_id, "❌ Word not found.");
      return;
    }

    const synonyms = word.synonyms?.length ? word.synonyms.join(", ") : "-";
    const reply = [
      `<b>${escapeHtml(word.word)}</b> <code>${escapeHtml(word.level || "B1")}</code>`,
      `⭐ Importance: ${word.importanceRate || 5}/10`,
      "",
      "📖 <b>Definition</b>",
      escapeHtml(word.definition),
      "",
      "✍️ <b>Example</b>",
      `<i>${escapeHtml(word.example || "")}</i>`,
      "",
      `🇺🇿 <b>Uzbek</b>: ${escapeHtml(word.uzbekMeaning || "-")}`,
      `🔊 <b>Pronunciation</b>: <code>${escapeHtml(word.pronunciation || "")}</code>`,
      `🔄 <b>Synonyms</b>: ${escapeHtml(synonyms)}`
    ].join("\n");

    await ctx.api.editMessageText(ctx.chat.id, waiting.message_id, reply, {
      parse_mode: "HTML",
      reply_markup: wordKeyboard(word._id)
    });
  });

  bot.catch((error) => {
    console.error("Bot error:", error.error);
  });

  return bot;
}

async function guardAdmin(ctx) {
  if (await isAdmin(ctx.from?.id)) return true;
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: "Admin access only.", show_alert: true });
  } else {
    await ctx.reply("Admin access only.");
  }
  return false;
}

async function getMissingRequiredChannels(ctx) {
  if (!(await getSubscriptionCheckEnabled())) return [];
  const channels = await getRequiredSubscriptionChannels();
  const missing = [];

  for (const channel of channels) {
    try {
      const member = await ctx.api.getChatMember(channel.chatId, ctx.from.id);
      if (!["member", "administrator", "creator"].includes(member.status)) {
        missing.push(channel);
      }
    } catch (error) {
      console.warn("Subscription check failed:", channel.chatId, error.message);
      missing.push(channel);
    }
  }

  return missing;
}

async function getRequiredSubscriptionChannels() {
  const channels = await listRequiredChannels({ activeOnly: true });
  if (channels.length) return channels;
  if (!config.channelId) return [];
  return [{
    name: config.channelName,
    chatId: config.channelId,
    username: config.channelUsername || String(config.channelId).replace("@", "")
  }];
}

async function handleAdminState(ctx, adminStates, broadcastDrafts) {
  const state = adminStates.get(ctx.from?.id);
  if (!state) return false;
  if (!(await isAdmin(ctx.from.id))) {
    adminStates.delete(ctx.from.id);
    return false;
  }

  if (state.type === "broadcast_wait_content") {
    broadcastDrafts.set(ctx.from.id, {
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id
    });
    adminStates.delete(ctx.from.id);
    const users = await getBroadcastUsers();
    await ctx.reply(`📣 Broadcast draft saved.\n\nRecipients: ${users.length} active users.\nUse copyMessage at a safe 20 msg/sec pace?`, {
      reply_markup: broadcastConfirmKeyboard()
    });
    return true;
  }

  if (state.type === "admin_add_name") {
    const name = ctx.message.text?.trim();
    if (!name) {
      await ctx.reply("Send the admin name as text.");
      return true;
    }
    adminStates.set(ctx.from.id, { type: "admin_add_id", name });
    await ctx.reply("Now send the admin Telegram ID.");
    return true;
  }

  if (state.type === "admin_add_id") {
    const telegramId = Number(ctx.message.text?.trim());
    if (!telegramId) {
      await ctx.reply("Telegram ID must be a number. Send it again.");
      return true;
    }
    await addAdmin({ telegramId, name: state.name, addedBy: ctx.from.id });
    adminStates.delete(ctx.from.id);
    await ctx.reply(`✅ Admin added: ${escapeHtml(state.name)} (${telegramId})`, {
      parse_mode: "HTML",
      reply_markup: adminPanelKeyboard()
    });
    return true;
  }

  if (state.type === "channel_add_name") {
    const name = ctx.message.text?.trim();
    if (!name) {
      await ctx.reply("Send the channel name as text.");
      return true;
    }
    adminStates.set(ctx.from.id, { type: "channel_add_id", name });
    await ctx.reply("Now send the channel username/link or numeric chat ID.\n\nExample: @my_channel or https://t.me/my_channel");
    return true;
  }

  if (state.type === "channel_add_id") {
    const chatId = ctx.message.text?.trim();
    if (!chatId) {
      await ctx.reply("Send a channel username/link or numeric chat ID.");
      return true;
    }
    const channel = await addRequiredChannel({ name: state.name, chatId, addedBy: ctx.from.id });
    adminStates.delete(ctx.from.id);
    await ctx.reply(`✅ Channel added: ${escapeHtml(channel.name)} (${escapeHtml(channel.chatId)})`, {
      parse_mode: "HTML",
      reply_markup: adminPanelKeyboard()
    });
    return true;
  }

  return false;
}

async function showAdminsPanel(ctx) {
  const admins = await listAdmins();
  const lines = [
    "👤 <b>Admins</b>",
    "",
    ...config.adminIds.map((id) => `🔒 ${id} <i>from .env</i>`),
    ...admins.map((admin) => `• ${escapeHtml(admin.name)} — <code>${admin.telegramId}</code>`)
  ];
  if (lines.length === 2) lines.push("No database admins yet.");

  await ctx.editMessageText(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: adminsKeyboard(admins)
  });
}

async function showChannelsPanel(ctx) {
  const [enabled, channels] = await Promise.all([
    getSubscriptionCheckEnabled(),
    listRequiredChannels({ activeOnly: true })
  ]);
  const lines = [
    "📢 <b>Required channels</b>",
    "",
    `Status: <b>${enabled ? "enabled" : "disabled"}</b>`,
    ""
  ];

  if (channels.length) {
    for (const channel of channels) {
      lines.push(`• ${escapeHtml(channel.name)} — <code>${escapeHtml(channel.chatId)}</code>`);
    }
  } else if (config.channelId) {
    lines.push(`Legacy .env channel: <code>${escapeHtml(config.channelId)}</code>`);
  } else {
    lines.push("No channels added yet.");
  }

  await ctx.editMessageText(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: channelsKeyboard(channels, enabled)
  });
}

async function formatAdminStats() {
  const stats = await getAdminStats();
  return [
    "📊 <b>LexiGO stats</b>",
    "",
    `<b>Users</b>`,
    `Active: <b>${stats.activeUsers}</b>`,
    `Inactive/blocked: <b>${stats.inactiveUsers}</b>`,
    `Total: <b>${stats.users}</b>`,
    `New today: <b>${stats.newToday}</b>`,
    "",
    `<b>Vocabulary</b>`,
    `Global dictionary words: <b>${stats.words}</b>`,
    `Collections: <b>${stats.collections}</b>`,
    `Saved study items: <b>${stats.studyItems}</b>`,
    `Due now: <b>${stats.dueItems}</b>`,
    `Mastered: <b>${stats.masteredItems}</b>`,
    "",
    `<b>Admin</b>`,
    `Admins: <b>${stats.admins}</b>`,
    `Required channels: <b>${stats.channels}</b>`,
    `Subscription check: <b>${stats.subscriptionEnabled ? "on" : "off"}</b>`
  ].join("\n");
}

async function runBroadcast(ctx, draft, statusMessageId) {
  const users = await getBroadcastUsers();
  const stats = { sent: 0, failed: 0, blocked: 0 };
  const startedAt = Date.now();

  for (const user of users) {
    try {
      await ctx.api.copyMessage(user.telegramId, draft.chatId, draft.messageId);
      stats.sent += 1;
    } catch (error) {
      const retryAfter = getRetryAfter(error);
      if (retryAfter) {
        await sleep((retryAfter + 1) * 1000);
        try {
          await ctx.api.copyMessage(user.telegramId, draft.chatId, draft.messageId);
          stats.sent += 1;
        } catch (retryError) {
          await handleBroadcastError(user.telegramId, retryError, stats);
        }
      } else {
        await handleBroadcastError(user.telegramId, error, stats);
      }
    }

    if ((stats.sent + stats.failed + stats.blocked) % 25 === 0) {
      await editBroadcastStatus(ctx, statusMessageId, stats, users.length, startedAt, false);
    }

    await sleep(50);
  }

  await editBroadcastStatus(ctx, statusMessageId, stats, users.length, startedAt, true);
}

async function handleBroadcastError(telegramId, error, stats) {
  const code = error.error_code || error.error?.error_code;
  const description = String(error.description || error.error?.description || "");
  if (code === 403 || /blocked|deactivated|forbidden/i.test(description)) {
    await markUserActive(telegramId, false);
    stats.blocked += 1;
    return;
  }
  stats.failed += 1;
}

async function editBroadcastStatus(ctx, messageId, stats, total, startedAt, done) {
  const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const text = [
    done ? "✅ <b>Broadcast finished</b>" : "📣 <b>Broadcast sending...</b>",
    "",
    `Sent: <b>${stats.sent}</b> / ${total}`,
    `Failed: <b>${stats.failed}</b>`,
    `Blocked marked inactive: <b>${stats.blocked}</b>`,
    `Elapsed: <b>${elapsed}s</b>`
  ].join("\n");

  try {
    await ctx.api.editMessageText(ctx.chat.id, messageId, text, {
      parse_mode: "HTML",
      reply_markup: done ? adminBackKeyboard() : undefined
    });
  } catch {
    // Status edits are nice-to-have; broadcast delivery should continue.
  }
}

function getRetryAfter(error) {
  return error.parameters?.retry_after || error.error?.parameters?.retry_after || 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function adminPanelKeyboard() {
  return new InlineKeyboard()
    .text("📊 Stat", "admin:stats")
    .text("📣 Sending", "admin:sending")
    .row()
    .text("👤 Admins", "admin:admins")
    .text("📢 Channels", "admin:channels");
}

function adminBackKeyboard() {
  return new InlineKeyboard().text("⬅️ Admin panel", "admin:panel");
}

function adminCancelKeyboard() {
  return new InlineKeyboard().text("Cancel", "admin:cancel");
}

function broadcastConfirmKeyboard() {
  return new InlineKeyboard()
    .text("✅ Send", "admin:broadcast:confirm")
    .text("Cancel", "admin:broadcast:cancel");
}

function adminsKeyboard(admins) {
  const keyboard = new InlineKeyboard().text("➕ Add admin", "admin:add_admin").row();
  for (const admin of admins) {
    if (!isBootstrapAdmin(admin.telegramId)) {
      keyboard.text(`Remove ${admin.name}`, `admin:remove_admin:${admin.telegramId}`).row();
    }
  }
  return keyboard.text("⬅️ Back", "admin:panel");
}

function channelsKeyboard(channels, enabled) {
  const keyboard = new InlineKeyboard()
    .text(enabled ? "Disable check" : "Enable check", "admin:toggle_channels")
    .row()
    .text("➕ Add channel", "admin:add_channel")
    .row();

  for (const channel of channels) {
    keyboard.text(`Remove ${channel.name}`, `admin:remove_channel:${channel._id}`).row();
  }

  return keyboard.text("⬅️ Back", "admin:panel");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendCleanMenu(ctx, menuMessages, text, options) {
  await deleteRememberedMenu(ctx, menuMessages);
  const sent = await ctx.reply(text, options);
  rememberMenuMessage(ctx, menuMessages, sent.message_id);
  return sent;
}

function rememberMenuMessage(ctx, menuMessages, messageId) {
  const chatId = ctx.chat?.id;
  if (!chatId || !messageId) return;
  menuMessages.set(chatId, messageId);
}

async function deleteRememberedMenu(ctx, menuMessages) {
  const chatId = ctx.chat?.id;
  const messageId = chatId ? menuMessages.get(chatId) : null;
  if (!chatId || !messageId) return;
  menuMessages.delete(chatId);
  try {
    await ctx.api.deleteMessage(chatId, messageId);
  } catch {
    // Telegram can reject deletion for old or already removed messages.
  }
}

async function deleteCurrentMessage(ctx) {
  try {
    await ctx.deleteMessage();
  } catch {
    // The current callback message may already be gone.
  }
}

function formatCollectionsMessage(rows) {
  if (!rows.length) {
    return [
      "📭 <b>No collections yet</b>",
      "",
      "Send a word, save it, and your first collection will appear here."
    ].join("\n");
  }

  const totals = rows.reduce((sum, row) => ({
    total: sum.total + row.progress.total,
    mastered: sum.mastered + row.progress.mastered,
    due: sum.due + row.progress.due
  }), { total: 0, mastered: 0, due: 0 });

  const lines = [
    "📚 <b>Your collections</b>",
    `🔥 ${totals.due} due today · 🏆 ${totals.mastered}/${totals.total} mastered`,
    ""
  ];

  for (const { collection, progress } of rows) {
    const dueLabel = progress.due > 0 ? `🔥 ${progress.due} due` : "✅ all clear";
    lines.push(
      `📁 <b>${escapeHtml(collection.name)}</b>`,
      `   🏆 ${progress.mastered}/${progress.total} mastered · ${dueLabel}`
    );
  }

  return lines.join("\n");
}
