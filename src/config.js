import dotenv from "dotenv";

dotenv.config();

const required = ["BOT_TOKEN", "OPENAI_API_KEY", "MONGODB_URI"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Missing ${key}. Add it to .env before running production.`);
  }
}

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lexigo",
  webappUrl: process.env.WEBAPP_URL || "http://localhost:3000",
  port: Number(process.env.PORT || 3000),
  adminIds: (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean),
  channelId: process.env.CHANNEL_ID || "@akbarshokh_blogs",
  channelUsername: process.env.CHANNEL_USERNAME || "akbarshokh_blogs",
  botMode: process.env.BOT_MODE || "polling",
  allowDevAuth: process.env.ALLOW_DEV_AUTH === "true"
};

export const isHttpsWebApp = config.webappUrl.startsWith("https://");

if (config.webappUrl && !isHttpsWebApp) {
  console.warn(
    "WEBAPP_URL is not HTTPS. Telegram WebApp buttons require an HTTPS URL. " +
      "Use an HTTPS tunnel/domain for real Telegram testing."
  );
}
