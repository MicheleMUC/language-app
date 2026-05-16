import { Router } from "express";
import { ai } from "./ai-client";

export const feedbackTurnRouter = Router();

const SYSTEM_PROMPT = `You are an expert Italian language coach reviewing a single student utterance.

Given the student's Italian text, return a JSON object with this exact structure:
{
  "ok": true|false,
  "correction": {
    "original": "<the erroneous word or short phrase>",
    "corrected": "<correct form>",
    "explanation": "<why, in English, max 12 words>"
  },
  "praise": "<optional: max 8 words in Italian if they did something notably well>"
}

Rules:
- If there are NO real errors, set ok=true and omit "correction".
- Only flag real grammatical or vocabulary errors (wrong tense, wrong agreement, wrong word).
- Never correct accent, spelling variations, or minor phrasing choices that are acceptable.
- "original" must be a substring of what the student actually said. Max 6 words.
- "praise" is optional — only include if they used a tricky structure well (e.g. subjunctive, passato prossimo with essere).
- If there are multiple errors, report only the most important one.
- Respond ONLY with valid JSON. No markdown, no code fences.`;

feedbackTurnRouter.post("/", async (req, res) => {
  const { italian, scenario, userLevel } = req.body as {
    italian: string;
    scenario?: { difficulty: string; characterName: string };
    userLevel?: string;
  };

  if (!italian?.trim()) return res.status(400).json({ error: "italian text required" });

  const context = `Student level: ${userLevel ?? "A2"}. Difficulty: ${scenario?.difficulty ?? "A2"}.

Student said: "${italian.trim()}"`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: { systemInstruction: SYSTEM_PROMPT },
      contents: context,
    });

    const raw = result.text?.trim() ?? "{}";
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({
      ok: parsed.ok ?? true,
      correction: parsed.correction ?? undefined,
      praise: parsed.praise ?? undefined,
    });
  } catch (e) {
    console.error("Turn feedback error:", e);
    // Fail silently — turn feedback is non-critical
    res.json({ ok: true });
  }
});
