import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

export const scenarioRouter = Router();

const ai = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: "us-central1" });

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

scenarioRouter.post("/", async (req, res) => {
  const { intent, userId } = req.body as { intent: string; userId: string };
  if (!intent) return res.status(400).json({ error: "intent required" });

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: { systemInstruction: SYSTEM_PROMPT },
      contents: intent,
    });

    const raw = result.text ?? "{}";
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data = JSON.parse(clean);

    res.json({
      ...data,
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
