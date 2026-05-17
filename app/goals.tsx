import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useGoal } from "@/hooks/useGoal";
import { usePreferences } from "@/hooks/usePreferences";
import { generateCurriculum } from "@/lib/api";
import { generateScenario, } from "@/lib/api";
import { saveGoal, saveScenario } from "@/lib/supabase";
import type { CurriculumScenario } from "@/types";

const GRAMMAR_LABELS: Record<string, string> = {
  passato_prossimo: "Passato Prossimo",
  subjunctive: "Congiuntivo",
  gender_agreement: "Accordo di Genere",
  pronoun_order: "Pronomi",
  future_tense: "Futuro",
  conditional: "Condizionale",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  A1: "#bfac26", A2: "#bfac26", B1: "#ff6d33", B2: "#ff6d33", C1: "#53397c", C2: "#53397c",
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 2) return null;
  const [month, year] = parts;
  const target = new Date(parseInt(year), parseInt(month) - 1, 1);
  const diff = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function GoalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { level } = usePreferences(user?.id);
  const { goal, loading: goalLoading, refresh, completeScenario } = useGoal(user?.id);

  const [destination, setDestination] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [startingIdx, setStartingIdx] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!destination.trim() || generating) return;
    setGenerating(true);
    try {
      const result = await generateCurriculum(destination.trim(), tripDate.trim() || undefined, level);
      if (!user?.id) return;
      await saveGoal({
        userId: user.id,
        destination: destination.trim(),
        tripDate: tripDate.trim() || undefined,
        scenarios: result.scenarios,
        grammarMilestones: result.grammarMilestones,
        estimatedWeeks: result.estimatedWeeks,
      });
      refresh();
      setDestination("");
      setTripDate("");
    } catch {
      Alert.alert("Errore", "Impossibile generare il curriculum. Il server è in esecuzione?");
    } finally {
      setGenerating(false);
    }
  };

  const handlePractice = async (scenario: CurriculumScenario, idx: number) => {
    if (startingIdx !== null) return;
    setStartingIdx(idx);
    try {
      const generated = await generateScenario(
        scenario.intent, user?.id ?? "", scenario.difficulty,
        undefined, scenario.grammarFocus,
      );
      const id = await saveScenario(generated).catch(() => `local_${Date.now()}`);
      const fullScenario = { ...generated, id };
      if (goal) completeScenario(scenario.intent);
      router.push(
        `/pre-session?scenarioId=${id}&scenarioData=${encodeURIComponent(JSON.stringify(fullScenario))}&characterName=${encodeURIComponent(generated.characterName)}&setting=${encodeURIComponent(generated.setting)}`
      );
    } catch {
      Alert.alert("Errore", "Impossibile generare lo scenario.");
    } finally {
      setStartingIdx(null);
    }
  };

  const days = goal ? daysUntil(goal.tripDate) : null;
  const progress = goal ? goal.completedIntents.length : 0;
  const total = goal?.scenarios.length ?? 0;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>Prepara il Viaggio</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
        >
          {goalLoading ? (
            <ActivityIndicator color="#ff6d33" style={{ marginTop: 60 }} />
          ) : goal ? (
            <>
              {/* Active goal header */}
              <View style={styles.goalHeader}>
                <Text style={styles.flagEmoji}>🇮🇹</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.goalDestination}>{goal.destination}</Text>
                  {days !== null && (
                    <Text style={styles.goalDays}>tra {days} giorni</Text>
                  )}
                </View>
                <View style={styles.progressBadge}>
                  <Text style={styles.progressBadgeText}>{progress}/{total}</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: total > 0 ? `${(progress / total) * 100}%` as `${number}%` : "0%" }]} />
              </View>

              {/* Grammar milestones */}
              {goal.grammarMilestones.length > 0 && (
                <View style={styles.milestonesCard}>
                  <Text style={styles.milestonesLabel}>PERCORSO GRAMMATICALE</Text>
                  {goal.grammarMilestones.map((m, i) => (
                    <View key={i} style={styles.milestoneRow}>
                      <Text style={styles.milestoneDot}>→</Text>
                      <Text style={styles.milestoneText}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Scenario list */}
              <Text style={styles.sectionLabel}>SCENARI DEL CURRICULUM</Text>
              <View style={{ gap: 12 }}>
                {goal.scenarios.map((s, i) => {
                  const done = goal.completedIntents.includes(s.intent);
                  const isStarting = startingIdx === i;
                  return (
                    <View key={i} style={[styles.scenarioRow, done && styles.scenarioRowDone]}>
                      <View style={[styles.stepNum, done && styles.stepNumDone]}>
                        {done ? (
                          <Text style={styles.checkmark}>✓</Text>
                        ) : (
                          <Text style={styles.stepNumText}>{i + 1}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.scenarioTitle, done && styles.scenarioTitleDone]}>{s.title}</Text>
                        <View style={styles.scenarioMeta}>
                          <View style={[styles.diffChip, { backgroundColor: DIFFICULTY_COLOR[s.difficulty] + "33" }]}>
                            <Text style={[styles.diffChipText, { color: DIFFICULTY_COLOR[s.difficulty] }]}>{s.difficulty}</Text>
                          </View>
                          <Text style={styles.grammarTag}>{GRAMMAR_LABELS[s.grammarFocus] ?? s.grammarFocus}</Text>
                        </View>
                      </View>
                      {!done && (
                        <TouchableOpacity
                          onPress={() => handlePractice(s, i)}
                          disabled={startingIdx !== null}
                          style={[styles.practiceBtn, startingIdx !== null && { opacity: 0.5 }]}
                          activeOpacity={0.8}
                        >
                          {isStarting ? (
                            <ActivityIndicator size="small" color="#5f1b00" />
                          ) : (
                            <Text style={styles.practiceBtnText}>Pratica</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* New goal button */}
              <TouchableOpacity
                onPress={() => refresh()}
                style={styles.newGoalBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.newGoalText}>+ Nuovo obiettivo di viaggio</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* No goal yet — show creation form */}
              <Text style={styles.introTitle}>Pianifica il tuo viaggio</Text>
              <Text style={styles.introSub}>
                Inserisci la tua destinazione e la data. Generiamo un curriculum di scenari su misura per prepararti al meglio.
              </Text>

              <Text style={styles.fieldLabel}>DESTINAZIONE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Es. Roma, Firenze, Amalfi..."
                placeholderTextColor="#a88a80"
                value={destination}
                onChangeText={setDestination}
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>DATA DEL VIAGGIO (opzionale)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="MM/AAAA — es. 08/2026"
                placeholderTextColor="#a88a80"
                value={tripDate}
                onChangeText={setTripDate}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
              />

              <TouchableOpacity
                onPress={handleGenerate}
                disabled={!destination.trim() || generating}
                style={[styles.generateBtn, (!destination.trim() || generating) && { opacity: 0.5 }]}
                activeOpacity={0.85}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#5f1b00" />
                ) : (
                  <Text style={styles.generateBtnText}>Genera Curriculum  ✦</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingVertical: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#594139",
  },
  backIcon: { fontSize: 20, color: "#e5e2e1" },
  logo: { fontSize: 17, fontWeight: "800", color: "#ffb59b" },

  // Active goal
  goalHeader: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  flagEmoji: { fontSize: 40 },
  goalDestination: { fontSize: 28, fontWeight: "800", color: "#e5e2e1", letterSpacing: -0.5 },
  goalDays: { fontSize: 14, color: "#a88a80", fontWeight: "600" },
  progressBadge: {
    backgroundColor: "#201f1f", borderRadius: 12, borderWidth: 1, borderColor: "#594139",
    paddingHorizontal: 12, paddingVertical: 6,
  },
  progressBadgeText: { fontSize: 16, fontWeight: "800", color: "#ff6d33" },
  progressTrack: {
    height: 8, backgroundColor: "#201f1f", borderRadius: 4,
    overflow: "hidden", marginBottom: 24,
  },
  progressFill: { height: "100%", backgroundColor: "#ff6d33", borderRadius: 4 },
  milestonesCard: {
    backgroundColor: "#201f1f", borderRadius: 16, borderWidth: 1,
    borderColor: "#353534", padding: 16, gap: 10, marginBottom: 28,
  },
  milestonesLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 3, textTransform: "uppercase" },
  milestoneRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  milestoneDot: { fontSize: 13, color: "#ff6d33", fontWeight: "700", marginTop: 1 },
  milestoneText: { flex: 1, fontSize: 13, color: "#a88a80", lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 },
  scenarioRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1c1b1b", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#353534",
  },
  scenarioRowDone: { opacity: 0.5 },
  stepNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#594139", flexShrink: 0,
  },
  stepNumDone: { backgroundColor: "#1a3a1a", borderColor: "#4caf50" },
  stepNumText: { fontSize: 13, fontWeight: "700", color: "#e1bfb4" },
  checkmark: { fontSize: 15, color: "#4caf50", fontWeight: "700" },
  scenarioTitle: { fontSize: 14, fontWeight: "600", color: "#e5e2e1" },
  scenarioTitleDone: { color: "#a88a80" },
  scenarioMeta: { flexDirection: "row", gap: 8, alignItems: "center" },
  diffChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  diffChipText: { fontSize: 11, fontWeight: "700" },
  grammarTag: { fontSize: 12, color: "#a88a80" },
  practiceBtn: {
    backgroundColor: "#ff6d33", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 64, alignItems: "center",
  },
  practiceBtnText: { fontSize: 13, fontWeight: "700", color: "#5f1b00" },
  newGoalBtn: {
    marginTop: 28, alignItems: "center", paddingVertical: 12,
    borderWidth: 1, borderColor: "#353534", borderRadius: 16,
    borderStyle: "dashed",
  },
  newGoalText: { fontSize: 14, color: "#594139", fontWeight: "600" },

  // Creation form
  introTitle: { fontSize: 28, fontWeight: "800", color: "#e5e2e1", letterSpacing: -0.5, marginBottom: 12, marginTop: 8 },
  introSub: { fontSize: 14, color: "#a88a80", lineHeight: 22, marginBottom: 32 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 },
  textInput: {
    backgroundColor: "#1c1b1b", borderWidth: 1.5, borderColor: "#594139",
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 16, color: "#e5e2e1", marginBottom: 24,
  },
  generateBtn: {
    backgroundColor: "#ff6d33", borderRadius: 50, paddingVertical: 18,
    alignItems: "center", marginTop: 8,
    shadowColor: "#ff6d33", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  generateBtnText: { fontSize: 17, fontWeight: "700", color: "#5f1b00" },
});
