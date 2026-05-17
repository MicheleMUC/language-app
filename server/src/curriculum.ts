import { Router } from "express";
import { ai } from "./ai-client";

export const curriculumRouter = Router();

const SYSTEM_PROMPT = `You are an Italian language learning curriculum designer.
Given a learner's trip destination and date, generate a focused curriculum to prepare them.
Return ONLY valid JSON matching this exact schema:
{
  "scenarios": [
    {
      "title": string,
      "intent": string,
      "grammarFocus": "passato_prossimo" | "subjunctive" | "gender_agreement" | "pronoun_order" | "future_tense" | "conditional",
      "difficulty": "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
    }
  ],
  "grammarMilestones": string[],
  "estimatedWeeks": number
}
Rules:
- 8-10 scenarios covering: ordering food, directions, shopping, hotel check-in, transportation, cultural small talk, plus destination-specific situations
- grammarFocus: assign the most relevant grammar category for each scenario
- grammarMilestones: 3-4 short strings like "Master present tense before attempting subjunctive"
- estimatedWeeks: realistic estimate at 3 sessions/week
- difficulty: start A2, progress naturally to B1-B2 for later scenarios`;

curriculumRouter.post("/", async (req, res) => {
  const { destination, tripDate, userLevel } = req.body as {
    destination: string;
    tripDate?: string;
    userLevel?: string;
  };

  if (!destination?.trim()) return res.status(400).json({ error: "destination required" });

  const tripContext = tripDate ? ` Trip date: ${tripDate}.` : "";
  const levelContext = userLevel ? ` Current level: ${userLevel}.` : " Current level: A2.";
  const prompt = `Generate an Italian learning curriculum for a trip to ${destination}.${tripContext}${levelContext}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: { systemInstruction: SYSTEM_PROMPT },
      contents: prompt,
    });
    const raw = result.text?.trim().replace(/```json\n?|\n?```/g, "").trim() ?? "{}";
    const parsed = JSON.parse(raw) as {
      scenarios: unknown[];
      grammarMilestones: string[];
      estimatedWeeks: number;
    };

    res.json({
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
      grammarMilestones: Array.isArray(parsed.grammarMilestones) ? parsed.grammarMilestones : [],
      estimatedWeeks: typeof parsed.estimatedWeeks === "number" ? parsed.estimatedWeeks : 4,
    });
  } catch (e) {
    console.error("Curriculum generation error:", e);
    res.status(500).json({ error: "Failed to generate curriculum" });
  }
});
