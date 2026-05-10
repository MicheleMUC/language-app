import { createClient } from "@supabase/supabase-js";
import type { Scenario, ConversationSession } from "@/types";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (!supabase) {
  console.warn("Supabase not configured — persistence disabled");
}

// ── Scenarios ────────────────────────────────────────────────────────────────

export async function saveScenario(scenario: Scenario): Promise<string> {
  if (!supabase) return scenario.id;
  const { data, error } = await supabase
    .from("scenarios")
    .insert({
      user_id: scenario.userId,
      intent: scenario.intent,
      character_name: scenario.characterName,
      character_description: scenario.characterDescription,
      setting: scenario.setting,
      difficulty: scenario.difficulty,
      vocabulary: scenario.vocabulary,
      likely_phrases: scenario.likelyPhrases,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function saveSession(
  session: Omit<ConversationSession, "id">
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("sessions").insert({
    scenario_id: session.scenarioId,
    user_id: session.userId,
    turns: session.turns,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? null,
    new_vocabulary: session.newVocabulary,
  });
  if (error) throw error;
}

export async function loadSessions(
  userId = "anonymous",
  limit = 20
): Promise<ConversationSession[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    scenarioId: row.scenario_id,
    userId: row.user_id,
    turns: row.turns,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    newVocabulary: row.new_vocabulary,
  }));
}
