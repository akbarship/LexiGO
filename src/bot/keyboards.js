import { InlineKeyboard } from "grammy";
import { config, isHttpsWebApp } from "../config.js";

function addPracticeButton(keyboard, label = "🧠 Practice now") {
  if (isHttpsWebApp) {
    return keyboard.webApp(label, config.webappUrl);
  }
  return keyboard.url("🌐 Open practice", config.webappUrl);
}

export function mainMenuKeyboard() {
  const keyboard = addPracticeButton(new InlineKeyboard());
  return keyboard.row().text("📚 My collections", "groups");
}

export function wordKeyboard(wordId) {
  const keyboard = new InlineKeyboard().text("➕ Save word", `save:${wordId}`);
  return addPracticeButton(keyboard, "🧠 Practice");
}

export function collectionsKeyboard(wordId, collections, savedCollectionIds = new Set()) {
  const keyboard = new InlineKeyboard();
  for (const collection of collections) {
    const isSaved = savedCollectionIds.has(collection._id.toString());
    keyboard
      .text(`${isSaved ? "✅ " : "📁 "}${collection.name}`, isSaved ? "noop:already_saved" : `add:${wordId}:${collection._id}`)
      .row();
  }
  if (isHttpsWebApp) {
    keyboard.webApp("✨ New collection", `${config.webappUrl}/?view=groups`);
  } else {
    keyboard.url("✨ New collection", `${config.webappUrl}/?view=groups`);
  }
  return keyboard;
}

export function savedKeyboard() {
  const keyboard = addPracticeButton(new InlineKeyboard(), "🚀 Practice now");
  return keyboard.row().text("🔎 Keep exploring", "keep_exploring");
}

export function subscribeKeyboard() {
  return new InlineKeyboard()
    .url("📢 Join channel", `https://t.me/${config.channelUsername.replace("@", "")}`)
    .row()
    .text("✅ I subscribed", "check_subscription");
}
