import { Collection, StudyItem } from "../models/index.js";
import { config } from "../config.js";
import { createCollection, listCollections } from "../services/collections.js";
import { getDashboard, getSession, gradeItem } from "../services/srs.js";
import { resolveWebUser } from "./auth.js";

export async function registerApiRoutes(app) {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    if (request.url.startsWith("/api/public-config")) return;
    request.user = await resolveWebUser(request);
    if (!request.user) {
      return reply.code(401).send({ error: "Telegram init data is missing or invalid." });
    }
  });

  app.get("/api/public-config", async () => ({
    botUsername: config.botUsername,
    botLink: `https://t.me/${config.botUsername}`
  }));

  app.get("/api/me", async (request) => {
    return getDashboard(request.user._id);
  });

  app.get("/api/collections", async (request) => {
    return listCollections(request.user._id);
  });

  app.post("/api/collections", async (request, reply) => {
    const name = request.body?.name?.trim();
    if (!name) return reply.code(400).send({ error: "Collection name is required." });
    try {
      return await createCollection(request.user._id, name);
    } catch (error) {
      if (error.code === 11000) {
        return reply.code(409).send({ error: "You already have a group with this name." });
      }
      throw error;
    }
  });

  app.patch("/api/collections/:id", async (request, reply) => {
    const update = {};
    if (request.body?.name) update.name = String(request.body.name).trim().slice(0, 40);
    if (request.body?.dailyGoal) update.dailyGoal = Number(request.body.dailyGoal);
    const collection = await Collection.findOneAndUpdate(
      { _id: request.params.id, userId: request.user._id },
      update,
      { returnDocument: "after" }
    );
    if (!collection) return reply.code(404).send({ error: "Group not found." });
    return collection;
  });

  app.delete("/api/collections/:id", async (request, reply) => {
    const collection = await Collection.findOne({
      _id: request.params.id,
      userId: request.user._id
    });
    if (!collection) return reply.code(404).send({ error: "Group not found." });
    if (isDefaultCollection(collection)) {
      return reply.code(403).send({ error: "My Vocabulary is the default collection and cannot be deleted." });
    }

    await Collection.deleteOne({ _id: collection._id, userId: request.user._id });

    const result = await StudyItem.deleteMany({
      userId: request.user._id,
      collectionId: collection._id
    });

    return {
      deleted: true,
      collectionId: collection._id,
      removedWords: result.deletedCount
    };
  });

  app.get("/api/session", async (request, reply) => {
    const collectionIds = String(request.query.collectionIds || request.query.collectionId || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!collectionIds.length) return reply.code(400).send({ error: "collectionIds is required." });

    const collections = await Collection.find({ _id: { $in: collectionIds }, userId: request.user._id });
    if (collections.length !== collectionIds.length) return reply.code(404).send({ error: "Group not found." });

    const items = await getSession(request.user._id, collectionIds);
    const collection = collections.length === 1
      ? collections[0]
      : { _id: "mixed", name: "Mixed review" };
    return { collection, items: items.map((item) => makeCard(item)) };
  });

  app.post("/api/grade", async (request, reply) => {
    const { itemId, grade } = request.body || {};
    if (!itemId || !["again", "hard", "good", "easy"].includes(grade)) {
      return reply.code(400).send({ error: "itemId and grade are required." });
    }

    const result = await gradeItem(request.user._id, itemId, grade);
    if (!result) return reply.code(404).send({ error: "Study item not found." });
    return {
      xp: result.xp,
      mastered: result.mastered,
      repeatNow: result.repeatNow,
      nextDueAt: result.nextDueAt,
      item: result.item
    };
  });

  app.get("/api/collections/:id/words", async (request, reply) => {
    const collection = await Collection.findOne({ _id: request.params.id, userId: request.user._id });
    if (!collection) return reply.code(404).send({ error: "Group not found." });

    const words = await StudyItem.find({ collectionId: collection._id })
      .populate("wordId")
      .sort({ createdAt: -1 });

    return words.map((item) => ({
      id: item._id,
      state: item.state,
      dueAt: item.dueAt,
      word: item.wordId
    }));
  });

  app.delete("/api/collections/:collectionId/words/:itemId", async (request, reply) => {
    const collection = await Collection.findOne({
      _id: request.params.collectionId,
      userId: request.user._id
    });
    if (!collection) return reply.code(404).send({ error: "Group not found." });

    const item = await StudyItem.findOneAndDelete({
      _id: request.params.itemId,
      collectionId: collection._id,
      userId: request.user._id
    });
    if (!item) return reply.code(404).send({ error: "Word not found in this collection." });

    return {
      deleted: true,
      itemId: item._id
    };
  });
}

function isDefaultCollection(collection) {
  return collection.isDefault || collection.name === "My Vocabulary";
}

function makeCard(item) {
  const word = item.wordId;
  return {
    id: item._id,
    word: word.word,
    level: word.level,
    pronunciation: word.pronunciation,
    example: word.example,
    hint: word.hint,
    definition: word.definition,
    uzbekMeaning: word.uzbekMeaning,
    synonyms: word.synonyms,
    state: item.state,
    reviews: item.reviews,
    intervalDays: item.intervalDays,
    repetitionCount: item.repetitionCount
  };
}
