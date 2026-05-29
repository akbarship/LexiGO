import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { registerApiRoutes } from "./api/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

export async function createServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
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
