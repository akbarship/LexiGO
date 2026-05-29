import { config } from "./config.js";
import { createBot } from "./bot/index.js";
import { connectDatabase } from "./db/connection.js";
import { createServer } from "./server.js";

async function main() {
  await connectDatabase();

  const app = await createServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });

  if (config.botToken) {
    const bot = createBot();
    if (config.botMode === "polling") {
      bot.start();
      console.log("grammY bot started in polling mode");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
