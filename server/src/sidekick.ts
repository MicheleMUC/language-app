import { Router } from "express";
import { GoogleGenAI } from "@google/genai";

export const sidekickRouter = Router();

const ai = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: "us-central1" });

sidekickRouter.post("/", async (req, res) => {
  const { question, recentTurns, scenario } = req.body as {
    question: string;
    recentTurns: Array<{ role: string; italian: string; english?: string }>;
    scenario: { characterName: string; setting: string; difficulty: string };
  };

  if (!question) return res.status(400).json({ error: "question required" });

  const conversationContext = recentTurns
    .map((t) => `${t.role === "user" ? "You" : scenario.characterName}: ${t.italian}`)
    .join("\n");

  const systemInstruction = `You are a friendly Italian language tutor called Sidekick.
The student is in a simulated Italian conversation with ${scenario.characterName} (${scenario.setting}).
Their level is ${scenario.difficulty}.

Recent conversation:
${conversationContext || "(conversation just started)"}

Answer the student's question concisely in English. Focus on grammar, vocabulary, and cultural context.
Be encouraging and practical. Keep your answer under 150 words.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: { systemInstruction },
      contents: question,
    });

    res.json({ answer: result.text ?? "" });
  } catch (e) {
    console.error("Sidekick error:", e);
    res.status(500).json({ error: "Failed to get sidekick response" });
  }
});
