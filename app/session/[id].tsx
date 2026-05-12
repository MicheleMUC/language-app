import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ConversationSession, SessionFeedback, GrammarCorrection } from "@/types";

function CorrectionsSection({ feedback }: { feedback: SessionFeedback }) {
  const hasCorrections = feedback.corrections.length > 0;
  const hasPatterns = feedback.patternsGood.length > 0 || feedback.patternsToImprove.length > 0;
  if (!hasCorrections && !hasPatterns) return null;

  return (
    <View style={styles.correctionsSection}>
      <Text style={styles.sectionLabel}>ANALISI GRAMMATICALE</Text>

      {hasCorrections && (
        <View style={{ gap: 10, marginBottom: hasPatterns ? 14 : 0 }}>
          {feedback.corrections.map((c: GrammarCorrection, i: number) => (
            <View key={i} style={styles.correctionRow}>
              <View style={styles.correctionLine}>
                <Text style={styles.correctionX}>✗</Text>
                <Text style={styles.correctionOriginalText}>"{c.original}"</Text>
              </View>
              <View style={styles.correctionLine}>
                <Text style={styles.correctionArrow}>↓</Text>
                <Text style={styles.correctionCheck}>✓</Text>
                <Text style={styles.correctionFixedText}>"{c.corrected}"</Text>
              </View>
              <Text style={styles.correctionExplanation}>{c.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      {hasPatterns && (
        <View style={{ gap: 6 }}>
          {feedback.patternsGood.map((p: string, i: number) => (
            <View key={`g${i}`} style={styles.patternRow}>
              <Text style={styles.patternGoodMark}>✓</Text>
              <Text style={styles.patternGoodText}>{p}</Text>
            </View>
          ))}
          {feedback.patternsToImprove.map((p: string, i: number) => (
            <View key={`i${i}`} style={styles.patternRow}>
              <Text style={styles.patternImproveMark}>→</Text>
              <Text style={styles.patternImproveText}>{p}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function SessionDetailScreen() {
  const { sessionData } = useLocalSearchParams<{ id: string; sessionData: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const session: ConversationSession = JSON.parse(decodeURIComponent(sessionData ?? "{}"));
  const date = new Date(session.startedAt).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Conversazione</Text>
            <Text style={styles.headerSub}>{date} · {session.turns.length} turni</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, paddingTop: 8 }}
        >
          {/* Chat bubbles */}
          {session.turns.map((turn, i) => {
            const isUser = turn.role === "user";
            return (
              <View key={i} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
                {!isUser && (
                  <View style={styles.avatarDot}>
                    <Text style={{ fontSize: 16 }}>🗣️</Text>
                  </View>
                )}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                  <Text style={[styles.bubbleItalian, isUser && styles.bubbleItalianUser]}>
                    {turn.italian}
                  </Text>
                  {turn.english ? (
                    <Text style={[styles.bubbleEnglish, isUser && styles.bubbleEnglishUser]}>
                      {turn.english}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}

          {/* Grammar analysis */}
          {session.feedback && <CorrectionsSection feedback={session.feedback} />}

          {/* Vocabulary section */}
          {session.newVocabulary.length > 0 && (
            <View style={styles.vocabSection}>
              <Text style={styles.vocabSectionLabel}>VOCABOLARIO ACQUISITO</Text>
              {session.newVocabulary.map((v, i) => (
                <View key={i} style={styles.vocabRow}>
                  <View style={styles.vocabIcon}>
                    <Text style={{ fontSize: 16, color: "#d6baff" }}>🔤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vocabItalian}>{v.italian}</Text>
                    <Text style={styles.vocabEnglish}>{v.english}</Text>
                  </View>
                </View>
              ))}
            </View>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#201f1f",
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#e5e2e1" },
  headerSub: { fontSize: 12, color: "#e1bfb4", marginTop: 2 },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 16,
  },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatarDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#201f1f",
    borderWidth: 1,
    borderColor: "#594139",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  bubbleAI: {
    backgroundColor: "#201f1f",
    borderWidth: 1,
    borderColor: "#353534",
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: "#ff6d33",
    borderBottomRightRadius: 4,
  },
  bubbleItalian: {
    fontSize: 15,
    fontWeight: "600",
    color: "#e5e2e1",
    lineHeight: 22,
  },
  bubbleItalianUser: { color: "#5f1b00" },
  bubbleEnglish: {
    fontSize: 12,
    color: "#e1bfb4",
    lineHeight: 18,
    opacity: 0.75,
    fontStyle: "italic",
  },
  bubbleEnglishUser: { color: "rgba(95,27,0,0.7)" },
  vocabSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#201f1f",
    gap: 10,
  },
  vocabSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e1bfb4",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  vocabRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#201f1f",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#353534",
  },
  vocabIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(214,186,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  vocabItalian: { fontSize: 15, fontWeight: "700", color: "#e5e2e1" },
  vocabEnglish: { fontSize: 13, color: "#e1bfb4", marginTop: 2 },
  correctionsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#201f1f",
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e1bfb4",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  correctionRow: {
    backgroundColor: "#201f1f",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#353534",
  },
  correctionLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  correctionX: { fontSize: 12, color: "#ff6b6b", fontWeight: "700" },
  correctionOriginalText: { fontSize: 14, color: "#ff6b6b", fontStyle: "italic" },
  correctionArrow: { fontSize: 12, color: "#594139" },
  correctionCheck: { fontSize: 12, color: "#66d17a", fontWeight: "700" },
  correctionFixedText: { fontSize: 14, color: "#66d17a", fontWeight: "600", fontStyle: "italic" },
  correctionExplanation: { fontSize: 12, color: "#a88a80", lineHeight: 18 },
  patternRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  patternGoodMark: { fontSize: 13, color: "#66d17a", fontWeight: "700", marginTop: 1 },
  patternGoodText: { flex: 1, fontSize: 13, color: "#66d17a", lineHeight: 19 },
  patternImproveMark: { fontSize: 13, color: "#dcc841", fontWeight: "700", marginTop: 1 },
  patternImproveText: { flex: 1, fontSize: 13, color: "#dcc841", lineHeight: 19 },
});
