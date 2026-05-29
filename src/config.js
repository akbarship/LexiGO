import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const required = ["BOT_TOKEN", "OPENAI_API_KEY", "MONGODB_URI"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Missing ${key}. Add it to .env before running production.`);
  }
}

function parseNumberList(value) {
  if (!value) return [];
  return String(value)
    .replaceAll("[", "")
    .replaceAll("]", "")
    .split(",")
    .map((id) => Number(String(id).trim()))
    .filter(Boolean);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function makeWebhookSecret() {
  if (process.env.WEBHOOK_SECRET) return process.env.WEBHOOK_SECRET;
  if (!process.env.BOT_TOKEN) return "";
  return crypto.createHash("sha256").update(process.env.BOT_TOKEN).digest("hex");
}

const webhookSecret = makeWebhookSecret();
const webhookPath = process.env.WEBHOOK_PATH || `/telegram/webhook/${webhookSecret.slice(0, 24)}`;
const webappUrl = process.env.WEBAPP_URL || "http://localhost:3000";
const botUsername = (process.env.BOT_USERNAME || "LexiGoo_bot").replace("@", "");

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  botUsername,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lexigo",
  webappUrl,
  port: Number(process.env.PORT || 3000),
  adminIds: parseNumberList(process.env.ADMIN_IDS),
  channelId: process.env.CHANNEL_ID || "@akbarshokh_blogs",
  channelName: process.env.CHANNEL_NAME || "LexiGO Channel",
  channelUsername: process.env.CHANNEL_USERNAME || "akbarshokh_blogs",
  botMode: process.env.BOT_MODE || "polling",
  allowDevAuth: process.env.ALLOW_DEV_AUTH === "true",
  webhookSecret,
  webhookPath,
  webhookUrl: process.env.WEBHOOK_URL || `${trimTrailingSlash(webappUrl)}${webhookPath}`
};

export const isHttpsWebApp = config.webappUrl.startsWith("https://");

if (config.webappUrl && !isHttpsWebApp) {
  console.warn(
    "WEBAPP_URL is not HTTPS. Telegram WebApp buttons require an HTTPS URL. " +
      "Use an HTTPS tunnel/domain for real Telegram testing."
  );
}
