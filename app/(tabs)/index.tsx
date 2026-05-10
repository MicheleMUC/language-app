import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScenarioCard } from "@/components/ScenarioCard";
import { FloatingNav } from "@/components/FloatingNav";
import { generateScenario } from "@/lib/api";
import { saveScenario } from "@/lib/supabase";
import type { Scenario } from "@/types";

const SUGGESTED = [
  {
    label: "Talking to\nneighbors",
    intent: "Talking to my Italian neighbors",
    bg: "#53397c",
    textColor: "#c5a8f3",
    emoji: "🏘️",
  },
  {
    label: "Market\nshopping",
    intent: "Shopping at an Italian outdoor market",
    bg: "#ff6d33",
    textColor: "#5f1b00",
    emoji: "🛍️",
  },
  {
    label: "At the\nTrattoria",
    intent: "Ordering food and wine at an Italian trattoria",
    bg: "#bfac26",
    textColor: "#484000",
    emoji: "🍝",
    description: "Master the art of ordering fine wine and pasta.",
  },
];

export default function HomeScreen() {
  const [intent, setIntent] = useState("");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSubmit = async (customIntent?: string) => {
    const trimmed = (customIntent ?? intent).trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const generated = await generateScenario(trimmed, "anonymous");
      const id = await saveScenario(generated).catch(() => `local_${Date.now()}`);
      setScenario({ ...generated, id });
    } catch {
      Alert.alert("Errore", "Could not generate scenario. Is the server running?");
    } finally {
      setLoading(false);
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
          <View style={styles.headerLeft}>
            <View style={styles.avatar} />
            <Text style={styles.logo}>L'Italiano</Text>
          </View>
          <View style={styles.bellBtn}>
            <Text style={{ fontSize: 18, color: "#ffb59b" }}>🔔</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* Welcome */}
          <View style={styles.welcome}>
            <Text style={styles.welcomeSub}>Buongiorno!</Text>
            <Text style={styles.welcomeTitle}>Benvenuti!</Text>
          </View>

          {/* Intent input + CTA */}
          <View style={styles.inputSection}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Cosa vuoi dire? (e.g., 'Order a coffee')"
                placeholderTextColor="#a88a80"
                value={intent}
                onChangeText={setIntent}
                returnKeyType="go"
                onSubmitEditing={() => handleSubmit()}
              />
              <Text style={styles.inputIcon}>🔍</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleSubmit()}
              disabled={!intent.trim() || loading}
              style={[styles.createBtn, (!intent.trim() || loading) && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#5f1b00" />
              ) : (
                <Text style={styles.createBtnIcon}>⊕</Text>
              )}
              <Text style={styles.createBtnText}>{loading ? "Creando..." : "Crea Scenario"}</Text>
            </TouchableOpacity>
          </View>

          {/* Suggested Scenarios */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suggested Scenarios</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See All →</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 16 }}>
              {SUGGESTED.map((s) => (
                <TouchableOpacity
                  key={s.intent}
                  onPress={() => handleSubmit(s.intent)}
                  disabled={loading}
                  style={[styles.scenarioCard, { backgroundColor: s.bg }]}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1, zIndex: 1 }}>
                    <View style={[styles.cardIconWrap, { backgroundColor: "rgba(0,0,0,0.18)" }]}>
                      <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
                    </View>
                    <Text style={[styles.cardLabel, { color: s.textColor }]}>{s.label}</Text>
                    {"description" in s && s.description ? (
                      <Text style={[styles.cardDesc, { color: s.textColor, opacity: 0.8 }]}>{s.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.cardIllustration}>
                    <Text style={{ fontSize: 64, opacity: 0.9 }}>{s.emoji}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Random scenario */}
              <TouchableOpacity
                onPress={() => handleSubmit("A random everyday Italian conversation scenario")}
                disabled={loading}
                style={styles.randomCard}
                activeOpacity={0.85}
              >
                <View style={styles.randomIcon}>
                  <Text style={{ fontSize: 32, color: "#ffb59b" }}>⇄</Text>
                </View>
                <Text style={styles.randomTitle}>Genera Scenario Casuale</Text>
                <Text style={styles.randomSub}>Lasciati sorprendere dall'IA</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Daily Goal */}
          <View style={styles.progressCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressLabel}>Daily Goal</Text>
              <Text style={styles.progressValue}>12 / 20 mins</Text>
              <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
              </View>
            </View>
            <View style={styles.streak}>
              <Text style={styles.streakNum}>🔥 4</Text>
              <Text style={styles.streakLabel}>Day Streak</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <FloatingNav active="home" />
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#53397c", borderWidth: 2, borderColor: "#ffb59b" },
  logo: { fontSize: 24, fontWeight: "800", color: "#ffb59b" },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center" },
  welcome: { paddingHorizontal: 24, paddingBottom: 20 },
  welcomeSub: { fontSize: 12, fontWeight: "700", color: "#d6baff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 },
  welcomeTitle: { fontSize: 48, fontWeight: "800", color: "#e5e2e1", lineHeight: 56, letterSpacing: -1 },
  inputSection: { paddingHorizontal: 24, gap: 12, marginBottom: 32 },
  inputWrapper: { position: "relative" },
  input: {
    backgroundColor: "#1c1b1b",
    borderWidth: 2,
    borderColor: "#594139",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingRight: 52,
    fontSize: 16,
    color: "#e5e2e1",
  },
  inputIcon: {
    position: "absolute",
    right: 18,
    top: "50%",
    marginTop: -10,
    fontSize: 20,
  },
  createBtn: {
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#ff6d33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnIcon: { fontSize: 22, color: "#5f1b00" },
  createBtnText: { fontSize: 18, fontWeight: "700", color: "#5f1b00" },
  section: { paddingHorizontal: 24, marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: { fontSize: 24, fontWeight: "700", color: "#e5e2e1" },
  seeAll: { fontSize: 13, fontWeight: "700", color: "#ffb59b" },
  scenarioCard: {
    borderRadius: 24,
    padding: 24,
    minHeight: 220,
    flexDirection: "row",
    alignItems: "flex-start",
    overflow: "hidden",
  },
  cardIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  cardLabel: { fontSize: 28, fontWeight: "700", lineHeight: 34, letterSpacing: -0.5 },
  cardDesc: { fontSize: 14, fontWeight: "500", lineHeight: 20, marginTop: 8, maxWidth: 180 },
  cardIllustration: {
    position: "absolute",
    bottom: -10,
    right: -10,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  randomCard: {
    borderWidth: 2,
    borderColor: "#594139",
    borderRadius: 24,
    borderStyle: "dashed",
    padding: 24,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  randomIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  randomTitle: { fontSize: 22, fontWeight: "700", color: "#e5e2e1", textAlign: "center" },
  randomSub: { fontSize: 14, color: "#e1bfb4", textAlign: "center" },
  progressCard: {
    marginHorizontal: 24,
    backgroundColor: "#201f1f",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#594139",
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginBottom: 8,
  },
  progressLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
  progressValue: { fontSize: 22, fontWeight: "700", color: "#e5e2e1", marginBottom: 12 },
  progressTrack: { height: 12, backgroundColor: "#131313", borderRadius: 6, overflow: "hidden" },
  progressFill: { width: "60%", height: "100%", backgroundColor: "#dcc841", borderRadius: 6 },
  streak: { alignItems: "center" },
  streakNum: { fontSize: 28, fontWeight: "800", color: "#ffb59b" },
  streakLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4" },
});
