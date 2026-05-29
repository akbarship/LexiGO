import { Bot } from "grammy";
import { config } from "../config.js";
import { getOrCreateWord } from "../services/dictionary.js";
import { addWordToCollection, collectionProgress, getCollectionIdsForWord, listCollections } from "../services/collections.js";
import { ensureUser } from "../services/users.js";
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

  bot.command("start", async (ctx) => {
    const user = await ensureUser(ctx.from);
    if (!(await isSubscribed(ctx))) {
      await ctx.reply("👋 Welcome to LexiGO.\n\n📢 Join our channel first to use the bot:", {
        reply_markup: subscribeKeyboard()
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
    if (await isSubscribed(ctx)) {
      await ensureUser(ctx.from);
      await ctx.editMessageText("✅ Thanks! Send any English word to begin ✍️", {
        reply_markup: mainMenuKeyboard()
      });
    } else {
      await ctx.answerCallbackQuery({ text: "❌ You have not subscribed yet.", show_alert: true });
    }
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
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    await ensureUser(ctx.from);
    if (!(await isSubscribed(ctx))) {
      await ctx.reply("📢 Join our channel to use LexiGO:", { reply_markup: subscribeKeyboard() });
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

async function isSubscribed(ctx) {
  if (!config.channelId) return true;
  try {
    const member = await ctx.api.getChatMember(config.channelId, ctx.from.id);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (error) {
    console.warn("Subscription check failed, allowing user:", error.message);
    return true;
  }
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
