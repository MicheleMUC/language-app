import { ai } from "./ai-client";

type PronunciationIssue = { phoneme: string; example: string; tip: string };

const TIMEOUT_MS = 3000;

export async function analyzePronunciation(
  audioBase64: string,
  mimeType: string,
): Promise<PronunciationIssue[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            {
              text: `Analyze the Italian pronunciation in this audio. The speaker is a language learner.
Identify 1-2 specific phoneme-level issues if present (e.g., double consonants geminates, vowel length, 'gli', 'gn', 'sc+i/e', rolled 'r').
If pronunciation is clear and acceptable, return {"issues": []}.
Be specific and constructive. Reference the actual word heard.
Return ONLY valid JSON: {"issues": [{"phoneme": string, "example": string, "tip": string}]}`,
            },
          ],
        },
      ],
    });

    const raw = result.text?.trim().replace(/```json\n?|\n?```/g, "").trim() ?? "{}";
    const parsed = JSON.parse(raw) as { issues?: PronunciationIssue[] };
    return Array.isArray(parsed.issues) ? parsed.issues.slice(0, 2) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
