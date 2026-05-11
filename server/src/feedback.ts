import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

export const feedbackRouter = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "";

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : new GoogleGenAI({ vertexai: true, project: PROJECT, location: "us-central1" });

feedbackRouter.post("/", async (req, res) => {
  const { turns, scenario, userLevel } = req.body as {
    turns: Array<{ role: string; italian: string }>;
    scenario: { difficulty: string; characterName: string };
    userLevel: string;
  };

  if (!turns?.length) return res.status(400).json({ error: "turns required" });

  const userTurns = turns
    .filter((t) => t.role === "user" && t.italian?.trim())
    .map((t) => `- "${t.italian.trim()}"`)
    .join("\n");

  if (!userTurns) {
    return res.json({
      praise: "Ottimo inizio!",
      tip: "Prova a usare più frasi complete la prossima volta.",
    });
  }

  const systemInstruction = `You are an expert Italian language coach giving feedback after a conversation practice session.
The student is at level ${userLevel ?? "A2"}. They just practiced a ${scenario?.difficulty ?? "A2"} scenario with ${scenario?.characterName ?? "an Italian speaker"}.

Student's Italian utterances:
${userTurns}

Write exactly 2 sentences in English:
1. Specific praise: mention a concrete word, phrase, or grammar structure they used correctly. Do not be generic.
2. Actionable tip: one specific grammar or vocabulary improvement tied to what they actually said.

Be warm and encouraging. Reference exact words or phrases they used. Keep each sentence under 25 words.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: { systemInstruction },
      contents: "Give feedback on this student's Italian practice session.",
    });

    const text = result.text?.trim() ?? "";
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    res.json({
      praise: sentences[0] ?? "Ottimo lavoro con la conversazione!",
      tip: sentences[1] ?? "Continua a praticare ogni giorno.",
    });
  } catch (e) {
    console.error("Feedback error:", e);
    res.status(500).json({ error: "Failed to generate feedback" });
  }
});
