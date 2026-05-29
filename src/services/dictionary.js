import OpenAI from "openai";
import { config } from "../config.js";
import { Word } from "../models/index.js";

let openai;

export function normalizeWord(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function getOrCreateWord(input) {
  const key = normalizeWord(input);
  if (!key || key.length > 80 || key.startsWith("/")) return null;

  const cached = await Word.findOne({ key });
  if (cached) return cached;

  const generated = await generateDefinition(key);
  if (!generated) return null;

  return Word.create({
    key,
    word: generated.word || key,
    level: generated.level || "B1",
    importanceRate: Number(generated.importanceRate ?? generated.importance_rate ?? 5),
    definition: generated.definition,
    example: generated.example,
    uzbekMeaning: generated.uzbekMeaning ?? generated.uzbek_meaning,
    pronunciation: generated.pronunciation,
    synonyms: Array.isArray(generated.synonyms) ? generated.synonyms : [],
    hint: generated.hint
  });
}

async function generateDefinition(word) {
  if (!config.openaiApiKey) {
    console.error("OPENAI_API_KEY is required to generate new definitions.");
    return null;
  }

  openai ||= new OpenAI({ apiKey: config.openaiApiKey });

  const prompt = `Return JSON only for an English learner dictionary entry.
Word: "${word}"
Rules:
- one common meaning only
- definition under 15 words, simple English
- Uzbek meaning under 8 words
- one natural example sentence
- IPA pronunciation
- 1-2 simple synonyms
- CEFR level: B1, B2, C1, or C2
- importanceRate: 0-10 where 10 is very common
Shape:
{
  "word": "abandon",
  "level": "B1",
  "importanceRate": 8,
  "definition": "to leave something or someone permanently",
  "uzbekMeaning": "qoldirmoq",
  "example": "He abandoned the project after losing interest.",
  "pronunciation": "/əˈbændən/",
  "synonyms": ["leave", "give up"],
  "hint": "leave forever"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Definition generation failed:", error.message);
    return null;
  }
}
