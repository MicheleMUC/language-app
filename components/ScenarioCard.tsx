import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { Scenario } from "@/types";

interface Props {
  scenario: Scenario;
  onStart: () => void;
  onBack: () => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  A1: "#bfac26", A2: "#bfac26",
  B1: "#ff6d33", B2: "#ff6d33",
  C1: "#53397c", C2: "#53397c",
};

const DIFFICULTY_TEXT_COLOR: Record<string, string> = {
  A1: "#201c00", A2: "#201c00",
  B1: "#5f1b00", B2: "#5f1b00",
  C1: "#c5a8f3", C2: "#c5a8f3",
};

const HERO_BG: Record<string, [string, string]> = {
  A1: ["#2a3a1a", "#1a2a0a"],
  A2: ["#3a2a0a", "#2a1a00"],
  B1: ["#3a1a00", "#1a0a00"],
  B2: ["#2a0a1a", "#1a0010"],
  C1: ["#1a0a3a", "#0a0020"],
  C2: ["#0a1a2a", "#000a1a"],
};

export function ScenarioCard({ scenario, onStart, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const diffColor = DIFFICULTY_COLOR[scenario.difficulty] ?? "#bfac26";
  const diffTextColor = DIFFICULTY_TEXT_COLOR[scenario.difficulty] ?? "#201c00";
  const heroBg = HERO_BG[scenario.difficulty] ?? ["#1a0a3a", "#0a0020"];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Floating back button */}
        <View style={[styles.headerOverlay, { top: insets.top + 8 }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>L'Italiano</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* Full-width 4:3 hero */}
          <View style={styles.hero}>
            <LinearGradient
              colors={[heroBg[0], heroBg[1]]}
              style={StyleSheet.absoluteFill}
            />
            {/* Decorative emoji backdrop */}
            <Text style={styles.heroEmoji}>🇮🇹</Text>
            {/* Bottom gradient overlay */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.85)"]}
              style={[StyleSheet.absoluteFill, { top: "40%" }]}
            />
            {/* Overlay content */}
            <View style={styles.heroContent}>
              <View style={[styles.diffBadge, { backgroundColor: diffColor }]}>
                <Text style={[styles.diffText, { color: diffTextColor }]}>
                  LIVELLO {scenario.difficulty}
                </Text>
              </View>
              <Text style={styles.heroTitle}>{scenario.setting}</Text>
              <View style={styles.heroButtons}>
                <TouchableOpacity onPress={onStart} style={styles.startBtn} activeOpacity={0.85}>
                  <Text style={styles.startBtnText}>Inizia Conversazione  ▶</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onBack} style={styles.changeBtn} activeOpacity={0.85}>
                  <Text style={styles.changeBtnText}>Cambia  ↺</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            {/* Description */}
            <Text style={styles.description}>{scenario.intent}</Text>

            {/* Objective card */}
            <View style={styles.objectiveCard}>
              <View style={styles.objectiveHeader}>
                <Text style={{ fontSize: 28 }}>🎯</Text>
                <Text style={styles.objectiveTitle}>Il Tuo Obiettivo</Text>
              </View>
              <Text style={styles.objectiveText}>
                {scenario.likelyPhrases.join(" · ")}
              </Text>
            </View>

            {/* Characters */}
            <Text style={styles.sectionLabel}>Incontra i Personaggi</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 24 }}
              contentContainerStyle={{ gap: 12, paddingRight: 4 }}
            >
              <View style={styles.characterCard}>
                <View style={styles.characterTop}>
                  <View style={styles.characterAvatar}>
                    <Text style={{ fontSize: 28 }}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.characterName}>{scenario.characterName}</Text>
                    <Text style={styles.characterRole}>Il tuo interlocutore</Text>
                  </View>
                </View>
                <Text style={styles.characterQuote}>"{scenario.characterDescription}"</Text>
              </View>
            </ScrollView>

            {/* Vocabulary */}
            <Text style={styles.sectionLabel}>Vocabolario Chiave</Text>
            <View style={styles.vocabCard}>
              {scenario.vocabulary.map((v, i) => (
                <View
                  key={v.italian}
                  style={[styles.vocabRow, i === scenario.vocabulary.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <Text style={styles.vocabItalian}>{v.italian}</Text>
                  <Text style={styles.vocabEnglish}>{v.english}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  headerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 20, color: "#e5e2e1" },
  logo: { fontSize: 22, fontWeight: "800", color: "#ffb59b" },
  hero: {
    width: "100%",
    aspectRatio: 4 / 3,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  heroEmoji: {
    position: "absolute",
    fontSize: 180,
    opacity: 0.08,
    alignSelf: "center",
    top: "15%",
  },
  heroContent: {
    padding: 20,
    gap: 8,
  },
  diffBadge: {
    alignSelf: "flex-start",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  diffText: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  heroTitle: { fontSize: 28, fontWeight: "700", color: "#e5e2e1", lineHeight: 34, letterSpacing: -0.5 },
  heroButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap",
  },
  startBtn: {
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: "#ff6d33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: { fontSize: 15, fontWeight: "700", color: "#5f1b00" },
  changeBtn: {
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  changeBtnText: { fontSize: 15, fontWeight: "700", color: "#e5e2e1" },
  body: { paddingHorizontal: 24, paddingTop: 24 },
  description: { fontSize: 16, color: "#e1bfb4", lineHeight: 24, marginBottom: 20 },
  objectiveCard: { backgroundColor: "#ff6d33", borderRadius: 20, padding: 24, marginBottom: 28, gap: 12 },
  objectiveHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  objectiveTitle: { fontSize: 22, fontWeight: "700", color: "#5f1b00" },
  objectiveText: { fontSize: 15, color: "#5f1b00", lineHeight: 22, opacity: 0.9 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 },
  characterCard: {
    backgroundColor: "#201f1f",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(89,65,57,0.3)",
    width: 256,
  },
  characterTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  characterAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#2a1a3a", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  characterName: { fontSize: 15, fontWeight: "700", color: "#e5e2e1" },
  characterRole: { fontSize: 12, color: "#e1bfb4", marginTop: 2 },
  characterQuote: { fontSize: 12, color: "#e1bfb4", fontStyle: "italic", lineHeight: 18 },
  vocabCard: { backgroundColor: "#201f1f", borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#594139" },
  vocabRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#353534" },
  vocabItalian: { fontSize: 16, fontWeight: "600", color: "#e5e2e1" },
  vocabEnglish: { fontSize: 14, color: "#e1bfb4" },
});
