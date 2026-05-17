import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useLearnerProfile } from "@/hooks/useLearnerProfile";

const CATEGORY_LABELS: Record<string, string> = {
  passato_prossimo: "il Passato Prossimo",
  subjunctive: "il Congiuntivo",
  gender_agreement: "l'Accordo di Genere",
  pronoun_order: "l'Ordine dei Pronomi",
  future_tense: "il Futuro",
  conditional: "il Condizionale",
};

const STATIC_GOALS = [
  { id: "vocab", label: "Usa 3 parole nuove", goal: "Use at least 3 new vocabulary words naturally in conversation" },
  { id: "time", label: "Parla per 5 minuti", goal: "Speak in complete Italian sentences for at least 5 minutes" },
];

export default function PreSessionScreen() {
  const { scenarioId, scenarioData, characterName, setting } = useLocalSearchParams<{
    scenarioId: string;
    scenarioData: string;
    characterName: string;
    setting: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useLearnerProfile(user?.id);

  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  // Build grammar goal from weakest category
  const weaknessEntries = Object.entries(profile?.weaknessMap ?? {});
  const weakest = weaknessEntries.length > 0
    ? weaknessEntries.reduce((w, c) => (c[1] < w[1] ? c : w))
    : null;
  const grammarGoal = weakest
    ? { id: "grammar", label: `Pratica ${CATEGORY_LABELS[weakest[0]] ?? weakest[0]}`, goal: `Practice ${weakest[0].replace(/_/g, " ")} — the character should naturally create 2-3 opportunities to use this grammar form` }
    : null;

  const goals = [
    ...(grammarGoal ? [grammarGoal] : []),
    ...STATIC_GOALS,
  ];

  const resolvedGoal = selected === "custom"
    ? (custom.trim() || null)
    : (goals.find((g) => g.id === selected)?.goal ?? null);

  const handleStart = () => {
    const params = new URLSearchParams({ scenarioData: scenarioData ?? "" });
    if (resolvedGoal) params.set("sessionGoal", resolvedGoal);
    router.replace(`/conversation/${scenarioId}?${params.toString()}`);
  };

  const handleSkip = () => {
    router.replace(`/conversation/${scenarioId}?scenarioData=${encodeURIComponent(scenarioData ?? "")}`);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>L'Italiano</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}
        >
          {/* Scenario mini-card */}
          <View style={styles.scenarioChip}>
            <Text style={styles.scenarioCharacter}>{characterName ?? "Scenario"}</Text>
            {setting ? <Text style={styles.scenarioSetting} numberOfLines={1}>{setting}</Text> : null}
          </View>

          <Text style={styles.title}>Imposta il tuo obiettivo</Text>
          <Text style={styles.subtitle}>Opzionale — scegli su cosa concentrarti oggi.</Text>

          <View style={styles.goalList}>
            {goals.map((g) => {
              const active = selected === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setSelected(active ? null : g.id)}
                  style={[styles.goalRow, active && styles.goalRowActive]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.goalLabel, active && styles.goalLabelActive]}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom goal */}
            <TouchableOpacity
              onPress={() => setSelected(selected === "custom" ? null : "custom")}
              style={[styles.goalRow, selected === "custom" && styles.goalRowActive]}
              activeOpacity={0.8}
            >
              <View style={[styles.radio, selected === "custom" && styles.radioActive]}>
                {selected === "custom" && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.goalLabel, selected === "custom" && styles.goalLabelActive]}>
                Obiettivo personalizzato
              </Text>
            </TouchableOpacity>

            {selected === "custom" && (
              <TextInput
                style={styles.customInput}
                placeholder="Es. Usa il condizionale per fare richieste educate"
                placeholderTextColor="#a88a80"
                value={custom}
                onChangeText={setCustom}
                multiline
                autoFocus
              />
            )}
          </View>

          <TouchableOpacity onPress={handleStart} style={styles.startBtn} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>
              {resolvedGoal ? "Inizia con obiettivo  ▶" : "Inizia  ▶"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Salta e inizia subito</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#594139",
  },
  backIcon: { fontSize: 20, color: "#e5e2e1" },
  logo: { fontSize: 20, fontWeight: "800", color: "#ffb59b" },
  scenarioChip: {
    backgroundColor: "#201f1f",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#353534",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 28,
    gap: 2,
  },
  scenarioCharacter: { fontSize: 15, fontWeight: "700", color: "#e5e2e1" },
  scenarioSetting: { fontSize: 13, color: "#a88a80" },
  title: { fontSize: 28, fontWeight: "800", color: "#e5e2e1", letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#a88a80", marginBottom: 28, lineHeight: 20 },
  goalList: { gap: 10, marginBottom: 32 },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#1c1b1b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#353534",
  },
  goalRowActive: { borderColor: "#ff6d33", backgroundColor: "#1f1410" },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "#594139",
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: "#ff6d33" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ff6d33" },
  goalLabel: { fontSize: 15, fontWeight: "600", color: "#a88a80", flex: 1 },
  goalLabelActive: { color: "#e5e2e1" },
  customInput: {
    backgroundColor: "#1c1b1b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ff6d33",
    padding: 14,
    fontSize: 14,
    color: "#e5e2e1",
    minHeight: 72,
    textAlignVertical: "top",
  },
  startBtn: {
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#ff6d33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: { fontSize: 17, fontWeight: "700", color: "#5f1b00" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 14, color: "#594139", fontWeight: "600" },
});
