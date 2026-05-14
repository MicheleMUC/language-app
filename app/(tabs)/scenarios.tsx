import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScenarioCard } from "@/components/ScenarioCard";
import { FloatingNav } from "@/components/FloatingNav";
import { generateScenario } from "@/lib/api";
import {
  saveScenario,
  loadRecentVocab,
  loadRecentFeedback,
  loadPregenScenarios,
  upsertPregenScenario,
  deletePregenScenario,
} from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { usePreferences } from "@/hooks/usePreferences";
import type { Scenario } from "@/types";

type Difficulty = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;

const LOADING_MESSAGES = [
  "Creo il personaggio...",
  "Preparo la scena...",
  "Scelgo il vocabolario...",
];

const ALL_SCENARIOS = [
  { label: "Talking to\nNeighbors", intent: "Talking to my Italian neighbors", bg: "#53397c", textColor: "#c5a8f3", emoji: "🏘️", difficulty: "A1" as const },
  { label: "Market\nShopping", intent: "Shopping at an Italian outdoor market", bg: "#ff6d33", textColor: "#5f1b00", emoji: "🛍️", difficulty: "A1" as const },
  { label: "At the\nTrattoria", intent: "Ordering food and wine at an Italian trattoria", bg: "#bfac26", textColor: "#484000", emoji: "🍝", difficulty: "A2" as const },
  { label: "Café\nBreak", intent: "Ordering coffee and breakfast at an Italian bar", bg: "#3a6b5a", textColor: "#a8e4d4", emoji: "☕", difficulty: "A1" as const },
  { label: "Train\nStation", intent: "Buying a train ticket and asking for directions", bg: "#1e3a5f", textColor: "#7ab3e0", emoji: "🚆", difficulty: "A2" as const },
  { label: "Doctor's\nAppointment", intent: "Explaining symptoms to a doctor in Italian", bg: "#5f1e3a", textColor: "#e07ab3", emoji: "🏥", difficulty: "B1" as const },
  { label: "Job\nInterview", intent: "A job interview at an Italian company", bg: "#1e5f3a", textColor: "#7ae0a8", emoji: "💼", difficulty: "B2" as const },
  { label: "Phone\nCall", intent: "Making a phone call to book a restaurant reservation", bg: "#5f3a1e", textColor: "#e0a87a", emoji: "📞", difficulty: "A2" as const },
  { label: "University\nSeminar", intent: "Discussing academic topics with Italian professors", bg: "#3a1e5f", textColor: "#a87ae0", emoji: "🎓", difficulty: "C1" as const },
  { label: "Political\nDebate", intent: "Debating current Italian political issues", bg: "#5f1e1e", textColor: "#e07a7a", emoji: "🗳️", difficulty: "C2" as const },
  { label: "Art\nGallery", intent: "Discussing Italian art and culture at a gallery", bg: "#1e4a5f", textColor: "#7ac3e0", emoji: "🎨", difficulty: "B1" as const },
  { label: "Apartment\nHunting", intent: "Viewing an apartment and negotiating rent in Italy", bg: "#4a5f1e", textColor: "#c3e07a", emoji: "🏠", difficulty: "B2" as const },
];

const DIFFICULTIES: { label: string; value: Difficulty }[] = [
  { label: "Tutti", value: null },
  { label: "A1", value: "A1" },
  { label: "A2", value: "A2" },
  { label: "B1", value: "B1" },
  { label: "B2", value: "B2" },
  { label: "C1", value: "C1" },
  { label: "C2", value: "C2" },
];

export default function ScenariosScreen() {
  const [filter, setFilter] = useState<Difficulty>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingIntent, setLoadingIntent] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [pregen, setPregen] = useState<Map<string, Scenario>>(new Map());

  const { user } = useAuth();
  const { level } = usePreferences(user?.id);
  const levelRef = useRef(level);
  const memoryRef = useRef<{ recentVocab: string[]; lastTip?: string }>({ recentVocab: [] });

  useEffect(() => { levelRef.current = level; }, [level]);

  // Loading message rotation
  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); return; }
    const id = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1500);
    return () => clearInterval(id);
  }, [loading]);

  // Phase 1 + Phase 2: load DB cache, then fill empty slots in background
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      // Load memory context and existing pre-generated scenarios in parallel
      const [vocab, tips, rows] = await Promise.all([
        loadRecentVocab(user.id),
        loadRecentFeedback(user.id),
        loadPregenScenarios(user.id),
      ]);
      if (cancelled) return;

      memoryRef.current = { recentVocab: vocab, lastTip: tips[0] };

      // Phase 1: populate pregen map from DB (instant)
      const initialPregen = new Map<string, Scenario>();
      for (const row of rows) {
        initialPregen.set(row.intent, {
          ...(row.data as Omit<Scenario, "id" | "intent" | "userId" | "createdAt">),
          id: `pregen_${row.intent}`,
          intent: row.intent,
          userId: user.id,
          createdAt: Date.now(),
        });
      }
      setPregen(initialPregen);

      // Phase 2: generate missing slots, 3 at a time (background — no loading UI)
      const missing = ALL_SCENARIOS.map((s) => s.intent).filter((i) => !initialPregen.has(i));

      for (let i = 0; i < missing.length; i += 3) {
        if (cancelled) break;
        const batch = missing.slice(i, i + 3);
        await Promise.all(
          batch.map(async (intent) => {
            if (cancelled) return;
            try {
              const generated = await generateScenario(
                intent,
                user.id,
                levelRef.current,
                memoryRef.current
              );
              if (cancelled) return;
              // Extract only the scenario content fields (not metadata) for DB storage
              const { id: _id, intent: _intent, userId: _userId, createdAt: _createdAt, ...scenarioData } = generated;
              await upsertPregenScenario(user.id, intent, scenarioData);
              if (cancelled) return;
              setPregen((prev) => {
                const next = new Map(prev);
                next.set(intent, { ...generated, id: `pregen_${intent}`, intent, userId: user.id });
                return next;
              });
            } catch {
              // silent — card falls back to live generation on tap
            }
          })
        );
      }
    })().catch(() => {});

    return () => { cancelled = true; };
  }, [user?.id]);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const filtered = filter ? ALL_SCENARIOS.filter((s) => s.difficulty === filter) : ALL_SCENARIOS;

  const handleSelect = async (intent: string) => {
    if (loading) return;

    // Fast path: use pre-generated scenario, free the slot for next regen
    const pregenScenario = pregen.get(intent);
    if (pregenScenario) {
      setPregen((prev) => { const next = new Map(prev); next.delete(intent); return next; });
      deletePregenScenario(user?.id ?? "", intent).catch(() => {});
      const id = await saveScenario(pregenScenario).catch(() => `local_${Date.now()}`);
      setScenario({ ...pregenScenario, id });
      return;
    }

    // Slow path: live generation
    setLoading(true);
    setLoadingIntent(intent);
    try {
      const generated = await generateScenario(intent, user?.id ?? "", levelRef.current, memoryRef.current);
      const id = await saveScenario(generated).catch(() => `local_${Date.now()}`);
      setScenario({ ...generated, id });
    } catch {
      Alert.alert("Errore", "Could not generate scenario. Is the server running?");
    } finally {
      setLoading(false);
      setLoadingIntent(null);
    }
  };

  if (scenario) {
    return (
      <ScenarioCard
        scenario={scenario}
        onBack={() => setScenario(null)}
        onStart={() =>
          router.push(
            `/conversation/${scenario.id}?scenarioData=${encodeURIComponent(JSON.stringify(scenario))}`
          )
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.pageLabel}>Scenari</Text>
            <Text style={styles.pageTitle}>Tutti gli Scenari</Text>
          </View>
        </View>

        {/* Difficulty filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d.label}
              onPress={() => setFilter(d.value)}
              style={[styles.chip, filter === d.value && styles.chipActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, filter === d.value && styles.chipTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 100, paddingTop: 8 }}
        >
          <View style={styles.grid}>
            {filtered.map((s) => {
              const isLoading = loadingIntent === s.intent;
              const isReady = pregen.has(s.intent);
              return (
                <TouchableOpacity
                  key={s.intent}
                  onPress={() => handleSelect(s.intent)}
                  disabled={loading}
                  style={[styles.card, { backgroundColor: s.bg }]}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.diffBadge}>
                      <Text style={styles.diffText}>{s.difficulty}</Text>
                    </View>
                    {isReady && <View style={styles.readyDot} />}
                  </View>
                  {isLoading ? (
                    <View style={{ marginVertical: 16, alignItems: "center", gap: 6 }}>
                      <ActivityIndicator size="small" color={s.textColor} />
                      <Text style={[styles.loadingMsg, { color: s.textColor }]}>
                        {LOADING_MESSAGES[loadingMsgIdx]}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.cardEmoji}>{s.emoji}</Text>
                  )}
                  <Text style={[styles.cardLabel, { color: s.textColor }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      <FloatingNav active="scenarios" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#201f1f",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#594139",
  },
  backIcon: { fontSize: 20, color: "#e5e2e1" },
  headerCenter: { flex: 1 },
  pageLabel: { fontSize: 11, fontWeight: "700", color: "#d6baff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: "#e5e2e1" },
  filterRow: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: "#201f1f",
    borderWidth: 1,
    borderColor: "#353534",
  },
  chipActive: { backgroundColor: "#ff6d33", borderColor: "#ff6d33" },
  chipText: { fontSize: 13, fontWeight: "700", color: "#e1bfb4" },
  chipTextActive: { color: "#5f1b00" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    width: "47%",
    borderRadius: 20,
    padding: 16,
    minHeight: 160,
    alignItems: "flex-start",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  diffBadge: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  diffText: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.85)", letterSpacing: 1 },
  readyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4caf50",
    opacity: 0.75,
  },
  cardEmoji: { fontSize: 44, alignSelf: "center", flex: 1, textAlignVertical: "center", paddingVertical: 8 },
  cardLabel: { fontSize: 16, fontWeight: "700", lineHeight: 22, letterSpacing: -0.3 },
  loadingMsg: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, opacity: 0.85, textAlign: "center" },
});
