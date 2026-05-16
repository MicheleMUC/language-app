import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const scenarioRouter = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : new GoogleGenAI({ vertexai: true, project: PROJECT, location: "us-central1" });

const SYSTEM_PROMPT = `You are an Italian language learning assistant.
Given a user's learning intent, generate a realistic Italian conversation scenario.
Respond ONLY with a valid JSON object matching this schema exactly:
{
  "characterName": string,
  "characterDescription": string (2-3 sentences about personality and speaking style),
  "setting": string (1-2 sentences describing the location and situation),
  "difficulty": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "vocabulary": [{ "italian": string, "english": string, "example": string }] (5-8 items),
  "likelyPhrases": string[] (3-5 Italian phrases the character might say)
}`;

const KNOWN_INTENTS = [
  "Talking to my Italian neighbors",
  "Shopping at an Italian outdoor market",
  "Ordering food and wine at an Italian trattoria",
  "Ordering coffee and breakfast at an Italian bar",
  "Buying a train ticket and asking for directions",
  "Explaining symptoms to a doctor in Italian",
  "A job interview at an Italian company",
  "Making a phone call to book a restaurant reservation",
  "Discussing academic topics with Italian professors",
  "Debating current Italian political issues",
  "Discussing Italian art and culture at a gallery",
  "Viewing an apartment and negotiating rent in Italy",
];

// Result cache keyed by intent (shared across users — scenarios are generic)
const scenarioCache = new Map<string, object>();
// In-flight promise map to collapse concurrent identical requests
const generating = new Map<string, Promise<object>>();

const CACHE_FILE = join(__dirname, "../../scenario-cache.json");

function loadCacheFromDisk() {
  try {
    const raw = readFileSync(CACHE_FILE, "utf-8");
    const entries = JSON.parse(raw) as Record<string, object>;
    for (const [key, val] of Object.entries(entries)) {
      scenarioCache.set(key, val);
    }
    console.log(`[cache] loaded ${scenarioCache.size} scenarios from disk`);
  } catch {
    // File doesn't exist yet — start fresh
  }
}

function saveCacheToDisk() {
  try {
    const entries: Record<string, object> = {};
    for (const [key, val] of scenarioCache.entries()) {
      entries[key] = val;
    }
    writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2));
  } catch (e) {
    console.error("[cache] failed to persist cache:", e);
  }
}

loadCacheFromDisk();

async function _doGenerate(
  intent: string,
  difficulty?: string,
  recentVocab?: string[],
  lastTip?: string
): Promise<object> {
  console.log(`[cache] generating intent: ${intent}${difficulty ? ` at ${difficulty}` : ""}`);
  const difficultyInstruction = difficulty
    ? `\nYou MUST set the difficulty field to "${difficulty}". Do not choose a different level.`
    : "";
  let memoryInstruction = "";
  if (recentVocab && recentVocab.length > 0) {
    memoryInstruction += `\n\nThe learner has recently encountered these Italian words — weave them into the scenario vocabulary list or the character's likely phrases where natural: ${recentVocab.join(", ")}.`;
  }
  if (lastTip) {
    memoryInstruction += `\n\nThe learner's coach last noted: "${lastTip}". Design the scenario so this grammar point comes up naturally in conversation.`;
  }
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    config: { systemInstruction: SYSTEM_PROMPT + difficultyInstruction + memoryInstruction },
    contents: intent,
  });
  const raw = result.text ?? "{}";
  const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(clean);
}

async function generateAndCache(intent: string, difficulty?: string): Promise<object> {
  // Only cache undirected requests (no difficulty override) to preserve diversity
  const cacheKey = difficulty ? `${intent}::${difficulty}` : intent;

  if (scenarioCache.has(cacheKey)) return scenarioCache.get(cacheKey)!;
  if (generating.has(cacheKey)) return generating.get(cacheKey)!;

  const promise = _doGenerate(intent, difficulty)
    .then((data) => { scenarioCache.set(cacheKey, data); saveCacheToDisk(); return data; })
    .finally(() => generating.delete(cacheKey));

  generating.set(cacheKey, promise);
  return promise;
}

async function warmCache() {
  for (const intent of KNOWN_INTENTS) {
    if (!scenarioCache.has(intent)) {
      await generateAndCache(intent).catch((e) =>
        console.error(`[cache] warm failed for "${intent}":`, e)
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("[cache] warm-up complete");
}

warmCache().catch(console.error);

scenarioRouter.post("/", async (req, res) => {
  const { intent, userId, difficulty, recentVocab, lastTip, force } = req.body as {
    intent: string;
    userId: string;
    difficulty?: string;
    recentVocab?: string[];
    lastTip?: string;
    force?: boolean;
  };
  if (!intent) return res.status(400).json({ error: "intent required" });

  try {
    const hasMemory = (recentVocab && recentVocab.length > 0) || !!lastTip;
    // Force-evict cache entry so a fresh one is generated and persisted
    if (force && !hasMemory) {
      const cacheKey = difficulty ? `${intent}::${difficulty}` : intent;
      scenarioCache.delete(cacheKey);
    }
    // Bypass shared cache for personalized requests so user-specific context is always fresh
    const data = hasMemory
      ? await _doGenerate(intent, difficulty, recentVocab, lastTip) as Record<string, unknown>
      : await generateAndCache(intent, difficulty) as Record<string, unknown>;

    res.json({
      ...data,
      ...(difficulty ? { difficulty } : {}),
      id: `scenario_${Date.now()}`,
      intent,
      userId: userId ?? "anonymous",
      createdAt: Date.now(),
    });
  } catch (e) {
    console.error("Scenario generation error:", e);
    res.status(500).json({ error: "Failed to generate scenario" });
  }
});
