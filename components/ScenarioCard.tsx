import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Scenario } from "@/types";

interface Props {
  scenario: Scenario;
  onStart: () => void;
  onBack: () => void;
}

const DIFFICULTY_BG: Record<string, string> = {
  A1: "#bfac26", A2: "#bfac26",
  B1: "#ff6d33", B2: "#ff6d33",
  C1: "#53397c", C2: "#53397c",
};

export function ScenarioCard({ scenario, onStart, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const diffBg = DIFFICULTY_BG[scenario.difficulty] ?? "#53397c";

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>L'Italiano</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroGradient}>
              <View style={styles.heroOverlay} />
              <View style={styles.heroBadgeRow}>
                <View style={[styles.diffBadge, { backgroundColor: diffBg }]}>
                  <Text style={styles.diffText}>LIVELLO {scenario.difficulty}</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>{scenario.setting}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24 }}>
            {/* Description */}
            <Text style={styles.description}>
              {scenario.characterDescription}
            </Text>

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
            <Text style={styles.sectionLabel}>INCONTRA I PERSONAGGI</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              <View style={styles.characterCard}>
                <View style={styles.characterAvatar}>
                  <Text style={{ fontSize: 28 }}>👤</Text>
                </View>
                <View>
                  <Text style={styles.characterName}>{scenario.characterName}</Text>
                  <Text style={styles.characterRole}>Il tuo interlocutore</Text>
                </View>
              </View>
            </ScrollView>

            {/* Vocabulary */}
            <Text style={styles.sectionLabel}>VOCABOLARIO CHIAVE</Text>
            <View style={styles.vocabCard}>
              {scenario.vocabulary.map((v) => (
                <View key={v.italian} style={styles.vocabRow}>
                  <Text style={styles.vocabItalian}>{v.italian}</Text>
                  <Text style={styles.vocabEnglish}>{v.english}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity onPress={onStart} style={styles.startBtn} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>Inizia Conversazione  ▶</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBack} style={styles.backBtnAlt} activeOpacity={0.85}>
              <Text style={styles.backBtnAltText}>Cambia Scenario  ↺</Text>
            </TouchableOpacity>
          </View>
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
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 20, color: "#e5e2e1" },
  logo: { fontSize: 22, fontWeight: "800", color: "#ffb59b" },
  hero: { marginHorizontal: 24, marginBottom: 24, borderRadius: 24, overflow: "hidden", height: 220 },
  heroGradient: { flex: 1, backgroundColor: "#53397c", justifyContent: "flex-end", padding: 20 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  heroBadgeRow: { marginBottom: 8 },
  diffBadge: { alignSelf: "flex-start", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4 },
  diffText: { fontSize: 11, fontWeight: "700", color: "#131313", letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontWeight: "700", color: "#e5e2e1", lineHeight: 32 },
  description: { fontSize: 16, color: "#e1bfb4", lineHeight: 24, marginBottom: 20 },
  objectiveCard: { backgroundColor: "#ff6d33", borderRadius: 20, padding: 24, marginBottom: 24, gap: 12 },
  objectiveHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  objectiveTitle: { fontSize: 22, fontWeight: "700", color: "#5f1b00" },
  objectiveText: { fontSize: 15, color: "#5f1b00", lineHeight: 22, opacity: 0.9 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 },
  characterCard: {
    backgroundColor: "#201f1f",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginRight: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#594139",
    width: 220,
  },
  characterAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#53397c", alignItems: "center", justifyContent: "center" },
  characterName: { fontSize: 16, fontWeight: "700", color: "#e5e2e1" },
  characterRole: { fontSize: 12, color: "#e1bfb4" },
  vocabCard: { backgroundColor: "#201f1f", borderRadius: 20, padding: 16, marginBottom: 32, borderWidth: 1, borderColor: "#594139" },
  vocabRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#353534" },
  vocabItalian: { fontSize: 16, fontWeight: "600", color: "#e5e2e1" },
  vocabEnglish: { fontSize: 14, color: "#e1bfb4" },
  startBtn: { backgroundColor: "#ff6d33", borderRadius: 50, paddingVertical: 20, alignItems: "center", marginBottom: 16 },
  startBtnText: { fontSize: 17, fontWeight: "700", color: "#5f1b00" },
  backBtnAlt: { backgroundColor: "#2a2a2a", borderRadius: 50, paddingVertical: 20, alignItems: "center", borderWidth: 1, borderColor: "#594139" },
  backBtnAltText: { fontSize: 17, fontWeight: "700", color: "#e5e2e1" },
});
