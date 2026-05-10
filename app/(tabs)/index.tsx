import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { ScenarioCard } from "@/components/ScenarioCard";
import { FloatingNav } from "@/components/FloatingNav";
import { generateScenario } from "@/lib/api";
import { db } from "@/lib/firebase";
import type { Scenario } from "@/types";

const SUGGESTED = [
  {
    label: "Talking to\nneighbors",
    intent: "Talking to my Italian neighbors",
    bg: "#53397c",
    textColor: "#c5a8f3",
    icon: "💬",
  },
  {
    label: "Market\nshopping",
    intent: "Shopping at an Italian outdoor market",
    bg: "#ff6d33",
    textColor: "#5f1b00",
    icon: "🛒",
  },
  {
    label: "At the\nTrattoria",
    intent: "Ordering food and wine at an Italian trattoria",
    bg: "#bfac26",
    textColor: "#484000",
    icon: "🍝",
  },
];

export default function HomeScreen() {
  const [intent, setIntent] = useState("");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.25, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseScale, pulseOpacity]);

  const handleSubmit = async () => {
    const trimmed = intent.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const generated = await generateScenario(trimmed, "anonymous");
      let id = `local_${Date.now()}`;
      if (db) {
        const docRef = await addDoc(collection(db, "scenarios"), generated);
        id = docRef.id;
      }
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

          {/* Intent input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Cosa vuoi dire? (e.g., 'Order a coffee')"
              placeholderTextColor="#a88a80"
              value={intent}
              onChangeText={setIntent}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {/* Mic hub */}
          <View style={styles.micHub}>
            <View style={styles.micOuter}>
              <Animated.View
                style={[
                  styles.micPulse,
                  { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                ]}
              />
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!intent.trim() || loading}
                style={[styles.micBtn, (!intent.trim() || loading) && { opacity: 0.5 }]}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="large" color="#5f1b00" />
                ) : (
                  <Text style={{ fontSize: 48 }}>🎙️</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.micTitle}>{loading ? "Creando..." : "Tap to Speak"}</Text>
            <Text style={styles.micSub}>Practice your pronunciation now</Text>
          </View>

          {/* Suggested scenarios */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggested Scenarios</Text>
            <View style={{ gap: 16 }}>
              {SUGGESTED.map((s) => (
                <TouchableOpacity
                  key={s.intent}
                  onPress={() => setIntent(s.intent)}
                  style={[styles.scenarioCard, { backgroundColor: s.bg }]}
                  activeOpacity={0.85}
                >
                  <View>
                    <View style={[styles.cardIconWrap, { backgroundColor: "rgba(0,0,0,0.15)" }]}>
                      <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                    </View>
                    <Text style={[styles.cardLabel, { color: s.textColor }]}>{s.label}</Text>
                  </View>
                  <Text style={{ fontSize: 52, opacity: 0.8 }}>
                    {s.icon === "💬" ? "🏘️" : s.icon === "🛒" ? "🛍️" : "🍷"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Progress widget */}
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
  welcome: { paddingHorizontal: 24, paddingBottom: 24 },
  welcomeSub: { fontSize: 12, fontWeight: "700", color: "#d6baff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 },
  welcomeTitle: { fontSize: 44, fontWeight: "800", color: "#e5e2e1", lineHeight: 52 },
  inputWrapper: { paddingHorizontal: 24, marginBottom: 8 },
  input: {
    backgroundColor: "#1c1b1b",
    borderWidth: 2,
    borderColor: "#594139",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    fontSize: 16,
    color: "#e5e2e1",
  },
  micHub: { alignItems: "center", paddingVertical: 32, gap: 16 },
  micOuter: { width: 128, height: 128, alignItems: "center", justifyContent: "center" },
  micPulse: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#ff6d33",
  },
  micBtn: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#ff6d33",
    alignItems: "center",
    justifyContent: "center",
  },
  micTitle: { fontSize: 24, fontWeight: "700", color: "#e5e2e1" },
  micSub: { fontSize: 15, color: "#e1bfb4" },
  section: { paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: { fontSize: 24, fontWeight: "700", color: "#e5e2e1", marginBottom: 16 },
  scenarioCard: {
    borderRadius: 24,
    padding: 24,
    minHeight: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardLabel: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
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
