import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useStats } from "@/hooks/useStats";
import { usePreferences } from "@/hooks/usePreferences";
import type { FeedbackLayers } from "@/types";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: "#dcc841", text: "#131313" },
  A2: { bg: "#dcc841", text: "#131313" },
  B1: { bg: "#ff6d33", text: "#131313" },
  B2: { bg: "#ff6d33", text: "#131313" },
  C1: { bg: "#53397c", text: "#d6baff" },
  C2: { bg: "#53397c", text: "#d6baff" },
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { streak, todayMinutes, totalSessions, loading } = useStats(user?.id);
  const { level, feedbackLayers, updateLevel, updateFeedbackLayer } = usePreferences(user?.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
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
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
        >
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 40 }}>👤</Text>
            </View>
            <Text style={styles.emailText}>{user?.email ?? ""}</Text>
            <Text style={styles.memberLabel}>Studente d'italiano</Text>
          </View>

          <Text style={styles.sectionLabel}>LE TUE STATISTICHE</Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: "#53397c" }]}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statNum}>{loading ? "—" : streak}</Text>
              <Text style={styles.statLabel}>Giorni di fila</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#ff6d33" }]}>
              <Text style={styles.statEmoji}>⏱️</Text>
              <Text style={[styles.statNum, { color: "#380d00" }]}>{loading ? "—" : todayMinutes}</Text>
              <Text style={[styles.statLabel, { color: "#380d00" }]}>Minuti oggi</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#201f1f", borderWidth: 1, borderColor: "#594139" }]}>
              <Text style={styles.statEmoji}>💬</Text>
              <Text style={styles.statNum}>{loading ? "—" : totalSessions}</Text>
              <Text style={styles.statLabel}>Conversazioni</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>IL MIO LIVELLO</Text>
          <View style={styles.levelRow}>
            {LEVELS.map((lvl) => {
              const isActive = level === lvl;
              const colors = LEVEL_COLORS[lvl];
              return (
                <TouchableOpacity
                  key={lvl}
                  onPress={() => updateLevel(lvl)}
                  style={[
                    styles.levelChip,
                    isActive && { backgroundColor: colors.bg },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.levelChipText, isActive && { color: colors.text }]}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>FEEDBACK</Text>
          <View style={styles.feedbackSection}>
            {(
              [
                { key: "microfeedback", label: "Correzione per turno", desc: "Piccola correzione dopo ogni tua risposta" },
                { key: "endSession", label: "Analisi fine sessione", desc: "Riepilogo completo a fine conversazione" },
              ] as { key: keyof FeedbackLayers; label: string; desc: string }[]
            ).map(({ key, label, desc }) => (
              <View key={key} style={styles.feedbackRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.feedbackLabel}>{label}</Text>
                  <Text style={styles.feedbackDesc}>{desc}</Text>
                </View>
                <Switch
                  value={feedbackLayers[key]}
                  onValueChange={(v) => updateFeedbackLayer(key, v)}
                  trackColor={{ false: "#353534", true: "#ff6d33" }}
                  thumbColor="#e5e2e1"
                />
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>COMPORTAMENTO AI</Text>
          <View style={styles.feedbackSection}>
            <View style={styles.feedbackRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.feedbackLabel}>Correzione naturale</Text>
                <Text style={styles.feedbackDesc}>L'AI corregge implicitamente nella risposta (cambia il comportamento, non solo le notifiche)</Text>
              </View>
              <Switch
                value={feedbackLayers.naturalCorrection}
                onValueChange={(v) => updateFeedbackLayer("naturalCorrection", v)}
                trackColor={{ false: "#353534", true: "#ff6d33" }}
                thumbColor="#e5e2e1"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.signOutText}>Disconnetti</Text>
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
  logo: { fontSize: 20, fontWeight: "800", color: "#ffb59b" },
  avatarSection: { alignItems: "center", paddingVertical: 32 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#53397c",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffb59b",
    marginBottom: 16,
  },
  emailText: { fontSize: 18, fontWeight: "700", color: "#e5e2e1", marginBottom: 4 },
  memberLabel: { fontSize: 13, color: "#e1bfb4", fontWeight: "600" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e1bfb4",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 32, flexWrap: "wrap" },
  statCard: {
    flex: 1,
    minWidth: "28%",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  statEmoji: { fontSize: 24 },
  statNum: { fontSize: 32, fontWeight: "800", color: "#e5e2e1" },
  statLabel: { fontSize: 11, fontWeight: "700", color: "rgba(229,226,225,0.7)", textAlign: "center" },
  levelRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
    flexWrap: "wrap",
  },
  levelChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 50,
    backgroundColor: "#201f1f",
    borderWidth: 1,
    borderColor: "#353534",
  },
  levelChipText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#e1bfb4",
    letterSpacing: 1,
  },
  feedbackSection: {
    backgroundColor: "#201f1f",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#353534",
    marginBottom: 32,
    overflow: "hidden",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#353534",
    gap: 12,
  },
  feedbackLabel: { fontSize: 14, fontWeight: "600", color: "#e5e2e1" },
  feedbackDesc: { fontSize: 12, color: "#a88a80" },
  signOutBtn: {
    backgroundColor: "#201f1f",
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#594139",
  },
  signOutText: { fontSize: 16, fontWeight: "700", color: "#e1bfb4" },
});
