import { config } from "./config.js";
import { createBot } from "./bot/index.js";
import { connectDatabase } from "./db/connection.js";
import { createServer } from "./server.js";

async function main() {
  await connectDatabase();

  const bot = config.botToken ? createBot() : null;
  const app = await createServer({ bot });
  await app.listen({ port: config.port, host: "0.0.0.0" });

  if (!bot) return;

  if (config.botMode === "webhook") {
    await bot.api.setWebhook(config.webhookUrl, {
      secret_token: config.webhookSecret
    });
    console.log(`grammY bot started in webhook mode at ${config.webhookPath}`);
  } else {
    await bot.api.deleteWebhook();
    bot.start();
    console.log("grammY bot started in polling mode");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
