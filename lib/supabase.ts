import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Scenario, ConversationSession, VocabItem, SessionFeedback } from "@/types";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
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
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      scenario_id: session.scenarioId,
      user_id: session.userId,
      turns: session.turns,
      started_at: session.startedAt,
      ended_at: session.endedAt ?? null,
      new_vocabulary: session.newVocabulary,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateSessionFeedback(
  sessionId: string,
  feedback: SessionFeedback
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("sessions")
    .update({ feedback })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function loadSessions(
  userId: string,
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
    feedback: row.feedback ?? undefined,
  }));
}

export async function loadSessionStats(
  userId: string
): Promise<Array<{ startedAt: number; endedAt: number }>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sessions")
    .select("started_at, ended_at")
    .eq("user_id", userId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    startedAt: row.started_at as number,
    endedAt: row.ended_at as number,
  }));
}

// ── User preferences ─────────────────────────────────────────────────────────

export async function savePreferences(userId: string, level: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("user_preferences").upsert(
    { user_id: userId, level, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function loadPreferences(userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_preferences")
    .select("level")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data?.level ?? null;
}

// ── Vocabulary bank ───────────────────────────────────────────────────────────

export async function upsertVocabulary(userId: string, items: VocabItem[]): Promise<void> {
  if (!supabase || items.length === 0) return;
  const { error } = await supabase.from("user_vocabulary").upsert(
    items.map((v) => ({
      user_id: userId,
      italian: v.italian,
      english: v.english,
      example: v.example ?? null,
    })),
    { onConflict: "user_id,italian", ignoreDuplicates: true }
  );
  if (error) throw error;

  const activeWords = items.filter((v) => v.activelyUsed).map((v) => v.italian);
  if (activeWords.length > 0) {
    const { error: updateError } = await supabase
      .from("user_vocabulary")
      .update({ actively_used: true })
      .eq("user_id", userId)
      .in("italian", activeWords)
      .eq("actively_used", false);
    if (updateError) throw updateError;
  }
}

export async function loadVocabulary(
  userId: string
): Promise<Array<VocabItem & { firstSeenAt: string }>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_vocabulary")
    .select("italian, english, example, first_seen_at, actively_used")
    .eq("user_id", userId)
    .order("first_seen_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    italian: row.italian,
    english: row.english,
    example: row.example ?? undefined,
    firstSeenAt: row.first_seen_at,
    activelyUsed: row.actively_used ?? false,
  }));
}
