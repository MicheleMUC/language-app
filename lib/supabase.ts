import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Scenario, ConversationSession, CurriculumScenario, LearningGoal, VocabItem, SessionFeedback, LearnerProfile, VocabEntry, WeaknessMap, UserContext } from "@/types";

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

// ── Pre-generated scenarios ───────────────────────────────────────────────────

export async function loadPregenScenarios(
  userId: string
): Promise<Array<{ intent: string; data: object }>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("pregenerated_scenarios")
    .select("intent, data")
    .eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((row) => ({ intent: row.intent as string, data: row.data as object }));
}

export async function upsertPregenScenario(
  userId: string,
  intent: string,
  scenarioData: object
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("pregenerated_scenarios").upsert(
    { user_id: userId, intent, data: scenarioData, generated_at: new Date().toISOString() },
    { onConflict: "user_id,intent" }
  );
  if (error) throw error;
}

export async function deletePregenScenario(userId: string, intent: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("pregenerated_scenarios").delete().eq("user_id", userId).eq("intent", intent);
}

// ── Learning goals (trip prep) ────────────────────────────────────────────────

export async function saveGoal(goal: Omit<LearningGoal, "id" | "createdAt" | "completedIntents">): Promise<LearningGoal | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("learning_goals")
    .insert({
      user_id: goal.userId,
      destination: goal.destination,
      trip_date: goal.tripDate ?? null,
      curriculum: goal.scenarios,
      grammar_milestones: goal.grammarMilestones,
      estimated_weeks: goal.estimatedWeeks,
      completed_intents: [],
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return rowToGoal(data);
}

export async function loadActiveGoal(userId: string): Promise<LearningGoal | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("learning_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return rowToGoal(data);
}

export async function markScenarioComplete(goalId: string, intent: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase
    .from("learning_goals")
    .select("completed_intents")
    .eq("id", goalId)
    .single();
  const current: string[] = (data?.completed_intents as string[]) ?? [];
  if (current.includes(intent)) return;
  await supabase
    .from("learning_goals")
    .update({ completed_intents: [...current, intent] })
    .eq("id", goalId);
}

function rowToGoal(row: Record<string, unknown>): LearningGoal {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    destination: row.destination as string,
    tripDate: (row.trip_date as string | null) ?? undefined,
    scenarios: (row.curriculum as CurriculumScenario[]) ?? [],
    grammarMilestones: (row.grammar_milestones as string[]) ?? [],
    estimatedWeeks: (row.estimated_weeks as number) ?? 4,
    completedIntents: (row.completed_intents as string[]) ?? [],
    createdAt: row.created_at as string,
  };
}

// ── Learner profile ───────────────────────────────────────────────────────────

export async function loadLearnerProfile(userId: string): Promise<LearnerProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("learner_profile")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return {
    userId: data.user_id,
    weaknessMap: (data.weakness_map ?? {}) as WeaknessMap,
    strongPatterns: (data.strong_patterns ?? []) as string[],
    vocabToReuse: (data.vocab_to_reuse ?? []) as VocabEntry[],
    userContext: (data.user_context ?? {}) as UserContext,
    updatedAt: data.updated_at,
  };
}

// ── Cross-session memory ──────────────────────────────────────────────────────

export async function loadRecentVocab(userId: string, limit = 10): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_vocabulary")
    .select("italian")
    .eq("user_id", userId)
    .order("first_seen_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => row.italian as string);
}

export async function loadRecentFeedback(userId: string, limit = 3): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sessions")
    .select("feedback")
    .eq("user_id", userId)
    .not("feedback", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? [])
    .map((row) => (row.feedback as { tip?: string } | null)?.tip)
    .filter((t): t is string => !!t);
}

export async function loadVocabulary(
  userId: string
): Promise<Array<VocabItem & { firstSeenAt: string; activelyUsed: boolean }>> {
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
