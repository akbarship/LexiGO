import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { webhookCallback } from "grammy";
import { registerApiRoutes } from "./api/routes.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

export async function createServer({ bot } = {}) {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  if (bot && config.botMode === "webhook") {
    app.post(
      config.webhookPath,
      webhookCallback(bot, "fastify", {
        secretToken: config.webhookSecret,
        timeoutMilliseconds: 10000,
        onTimeout: "return"
      })
    );
  }

  await registerApiRoutes(app);
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/"
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });

  return app;
}
