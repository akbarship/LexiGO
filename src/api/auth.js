import crypto from "node:crypto";
import { config } from "../config.js";
import { ensureUser } from "../services/users.js";

export async function resolveWebUser(request) {
  const devTelegramId = request.query.telegramId || request.headers["x-dev-telegram-id"];
  if (devTelegramId && (config.webappUrl.includes("localhost") || config.allowDevAuth)) {
    return ensureUser({ id: Number(devTelegramId), first_name: "Local" });
  }

  const initData = request.headers["x-telegram-init-data"] || request.query.initData;
  const parsed = verifyInitData(initData);
  if (!parsed?.user) return null;

  return ensureUser(parsed.user);
}

export function verifyInitData(initData) {
  if (!initData || !config.botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (!hash || hash.length !== calculated.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculated))) return null;

  const user = JSON.parse(params.get("user") || "{}");
  return { user };
}
