import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

export const feedbackRouter = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : new GoogleGenAI({ vertexai: true, project: PROJECT, location: "us-central1" });

const SYSTEM_PROMPT = `You are an expert Italian language coach analyzing a student's conversation practice session.

Given the student's Italian utterances, return a JSON object with this exact structure:
{
  "praise": "<1 specific sentence praising a concrete word, phrase, or structure they used well>",
  "tip": "<1 actionable improvement sentence tied to what they actually said>",
  "corrections": [
    { "original": "<the erroneous phrase or sentence>", "corrected": "<corrected version>", "explanation": "<brief English reason>" }
  ],
  "patternsGood": ["<grammar or vocab pattern they used correctly>"],
  "patternsToImprove": ["<pattern they should practice>"]
}

Rules:
- corrections: 0-5 items. Only include real grammatical or vocabulary errors. Skip minor accent or phrasing choices.
- patternsGood: 1-2 items max. Only if clearly demonstrated.
- patternsToImprove: 1-2 items max. Be specific (e.g. "passato prossimo with essere verbs" not "past tense").
- All text under 25 words per item. Be warm and constructive.
- Respond ONLY with valid JSON. No markdown, no code fences.`;

feedbackRouter.post("/", async (req, res) => {
  const { turns, scenario, userLevel } = req.body as {
    turns: Array<{ role: string; italian: string }>;
    scenario: { difficulty: string; characterName: string };
    userLevel: string;
  };

  if (!turns?.length) return res.status(400).json({ error: "turns required" });

  const userTurns = turns
    .filter((t) => t.role === "user" && t.italian?.trim())
    .map((t, i) => `${i + 1}. "${t.italian.trim()}"`)
    .join("\n");

  if (!userTurns) {
    return res.json({
      praise: "Ottimo inizio!",
      tip: "Prova a usare più frasi complete la prossima volta.",
      corrections: [],
      patternsGood: [],
      patternsToImprove: [],
    });
  }

  const userContext = `Student level: ${userLevel ?? "A2"}. Scenario difficulty: ${scenario?.difficulty ?? "A2"} with ${scenario?.characterName ?? "an Italian speaker"}.

Student's Italian utterances:
${userTurns}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: { systemInstruction: SYSTEM_PROMPT },
      contents: userContext,
    });

    const raw = result.text?.trim() ?? "{}";
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({
      praise: parsed.praise ?? "Ottimo lavoro con la conversazione!",
      tip: parsed.tip ?? "Continua a praticare ogni giorno.",
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      patternsGood: Array.isArray(parsed.patternsGood) ? parsed.patternsGood : [],
      patternsToImprove: Array.isArray(parsed.patternsToImprove) ? parsed.patternsToImprove : [],
    });
  } catch (e) {
    console.error("Feedback error:", e);
    res.status(500).json({ error: "Failed to generate feedback" });
  }
});
