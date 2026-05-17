import { createClient } from "@supabase/supabase-js";
import { ai } from "./ai-client";

type GrammarCategory =
  | "passato_prossimo" | "subjunctive" | "gender_agreement"
  | "pronoun_order" | "future_tense" | "conditional" | "other";

type WeaknessMap = Partial<Record<GrammarCategory, number>>;
type UserContext = { name?: string; occupation?: string; topics_mentioned?: string[]; last_session?: string; conversation_count?: number };
type VocabEntry = { word: string; seen_count: number };
type LearnerProfile = { userId: string; weaknessMap: WeaknessMap; strongPatterns: string[]; vocabToReuse: VocabEntry[]; userContext: UserContext; updatedAt: string };
type GrammarCorrection = { original: string; corrected: string; explanation: string };
type SessionFeedback = { corrections: GrammarCorrection[]; patternsGood: string[]; patternsToImprove: string[] };
type ConversationTurn = { role: string; italian: string };

// Service-role client bypasses RLS for server-side writes
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const GRAMMAR_CATEGORIES: GrammarCategory[] = [
  "passato_prossimo", "subjunctive", "gender_agreement",
  "pronoun_order", "future_tense", "conditional",
];

const EMA_ALPHA = 0.25; // weight of the most recent session in the rolling score

type ClassifiedItem = { category: GrammarCategory; isError: boolean };

async function classifyCorrections(
  corrections: SessionFeedback["corrections"],
  patternsGood: string[],
  patternsToImprove: string[],
): Promise<ClassifiedItem[]> {
  if (corrections.length === 0 && patternsGood.length === 0 && patternsToImprove.length === 0) return [];

  const items = [
    ...corrections.map((c) => ({ text: `ERROR: ${c.explanation}`, isError: true })),
    ...patternsGood.map((p) => ({ text: `GOOD: ${p}`, isError: false })),
    ...patternsToImprove.map((p) => ({ text: `NEEDS_WORK: ${p}`, isError: true })),
  ];

  const prompt = `Classify each Italian grammar feedback item into exactly one category.
Categories: ${GRAMMAR_CATEGORIES.join(", ")}, other

Items:
${items.map((item, i) => `${i}. ${item.text}`).join("\n")}

Return a JSON array with one object per item, in order:
[{"index": 0, "category": "passato_prossimo"}, ...]

Return ONLY valid JSON. No markdown.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const raw = result.text?.trim().replace(/```json\n?|\n?```/g, "").trim() ?? "[]";
    const parsed = JSON.parse(raw) as Array<{ index: number; category: string }>;
    return parsed.map((r) => ({
      category: (GRAMMAR_CATEGORIES.includes(r.category as GrammarCategory) ? r.category : "other") as GrammarCategory,
      isError: items[r.index]?.isError ?? true,
    }));
  } catch (e) {
    console.error("[learner-profile] classifyCorrections error:", e);
    return [];
  }
}

async function extractUserContext(turns: ConversationTurn[], existing: UserContext): Promise<UserContext> {
  const transcript = turns
    .filter((t) => t.role === "user" && t.italian?.trim())
    .map((t) => t.italian.trim())
    .join(" | ");

  if (!transcript) return existing;

  const prompt = `From this Italian language practice conversation (learner's utterances only), extract memorable facts about the learner.
Return JSON: {"name": string|null, "occupation": string|null, "topics_mentioned": string[], "last_session": string}
- name: first name if mentioned, else null
- occupation: job/role if mentioned, else null
- topics_mentioned: up to 5 topics discussed (Italian words preferred)
- last_session: one-line summary of what was practiced (e.g. "trattoria — ordered wine, practiced passato prossimo")

Existing context (merge, don't lose previous facts): ${JSON.stringify(existing)}

Learner utterances: ${transcript}

Return ONLY valid JSON.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const raw = result.text?.trim().replace(/```json\n?|\n?```/g, "").trim() ?? "{}";
    const extracted = JSON.parse(raw) as Partial<UserContext>;
    return {
      name: extracted.name ?? existing.name,
      occupation: extracted.occupation ?? existing.occupation,
      topics_mentioned: [
        ...new Set([...(existing.topics_mentioned ?? []), ...(extracted.topics_mentioned ?? [])]),
      ].slice(0, 20),
      last_session: extracted.last_session ?? existing.last_session,
      conversation_count: (existing.conversation_count ?? 0) + 1,
    };
  } catch (e) {
    console.error("[learner-profile] extractUserContext error:", e);
    return { ...existing, conversation_count: (existing.conversation_count ?? 0) + 1 };
  }
}

function updateWeaknessMap(current: WeaknessMap, classified: ClassifiedItem[]): WeaknessMap {
  const updated = { ...current };
  const categoryStats: Record<string, { correct: number; errors: number }> = {};

  for (const item of classified) {
    if (item.category === "other") continue;
    if (!categoryStats[item.category]) categoryStats[item.category] = { correct: 0, errors: 0 };
    if (item.isError) categoryStats[item.category].errors++;
    else categoryStats[item.category].correct++;
  }

  for (const [cat, stats] of Object.entries(categoryStats)) {
    const total = stats.correct + stats.errors;
    if (total === 0) continue;
    const sessionScore = stats.correct / total;
    const prevScore = updated[cat as GrammarCategory] ?? 0.5;
    updated[cat as GrammarCategory] = parseFloat(((1 - EMA_ALPHA) * prevScore + EMA_ALPHA * sessionScore).toFixed(3));
  }

  return updated;
}

function updateVocabToReuse(current: VocabEntry[], corrections: SessionFeedback["corrections"]): VocabEntry[] {
  const updated = [...current];

  // Extract Italian words from corrected phrases (single words only, length > 3)
  const newWords = corrections.flatMap((c) =>
    c.corrected.split(/\s+/).filter((w) => w.length > 3 && /^[a-zA-Zàáâãäåèéêëìíîïòóôõöùúûü]+$/.test(w))
  );

  for (const word of newWords) {
    const existing = updated.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (existing) {
      existing.seen_count++;
    } else {
      updated.push({ word: word.toLowerCase(), seen_count: 1 });
    }
  }

  // Remove mastered words (seen 3+ times)
  const active = updated.filter((v) => v.seen_count < 3);

  // Enforce max 50: drop highest seen_count entries first (least need for practice)
  if (active.length > 50) {
    active.sort((a, b) => a.seen_count - b.seen_count);
    return active.slice(0, 50);
  }

  return active;
}

export async function updateLearnerProfile(
  userId: string,
  feedback: SessionFeedback,
  turns: ConversationTurn[],
): Promise<void> {
  if (!supabase) {
    console.warn("[learner-profile] Supabase not configured — skipping profile update");
    return;
  }

  // Fetch existing profile (or start fresh)
  const { data: existing } = await supabase
    .from("learner_profile")
    .select("*")
    .eq("user_id", userId)
    .single();

  const currentProfile: LearnerProfile = existing
    ? {
        userId,
        weaknessMap: (existing.weakness_map ?? {}) as WeaknessMap,
        strongPatterns: (existing.strong_patterns ?? []) as string[],
        vocabToReuse: (existing.vocab_to_reuse ?? []) as VocabEntry[],
        userContext: (existing.user_context ?? {}) as UserContext,
        updatedAt: existing.updated_at,
      }
    : { userId, weaknessMap: {}, strongPatterns: [], vocabToReuse: [], userContext: {}, updatedAt: new Date().toISOString() };

  // Run classification and context extraction in parallel
  const [classified, newUserContext] = await Promise.all([
    classifyCorrections(feedback.corrections, feedback.patternsGood, feedback.patternsToImprove),
    extractUserContext(turns, currentProfile.userContext),
  ]);

  const newWeaknessMap = updateWeaknessMap(currentProfile.weaknessMap, classified);
  const newVocabToReuse = updateVocabToReuse(currentProfile.vocabToReuse, feedback.corrections);

  const { error } = await supabase.from("learner_profile").upsert(
    {
      user_id: userId,
      weakness_map: newWeaknessMap,
      strong_patterns: currentProfile.strongPatterns,
      vocab_to_reuse: newVocabToReuse,
      user_context: newUserContext,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[learner-profile] upsert error:", error);
  } else {
    console.log(`[learner-profile] updated for ${userId} — categories: ${Object.keys(newWeaknessMap).join(", ")}`);
  }
}
