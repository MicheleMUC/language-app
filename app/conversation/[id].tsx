import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AudioWaveform } from "@/components/AudioWaveform";
import { VocabHint } from "@/components/VocabHint";
import { Sidekick } from "@/components/Sidekick";
import { useConversation } from "@/hooks/useConversation";
import { useSidekick } from "@/hooks/useSidekick";
import { usePreferences } from "@/hooks/usePreferences";
import { saveSession, upsertVocabulary, updateSessionFeedback } from "@/lib/supabase";
import { requestFeedback } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Scenario, ConversationTurn, VocabItem, SessionFeedback } from "@/types";

function PulseRings() {
  const scale1 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.4)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const ring = (s: Animated.Value, o: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(s, { toValue: 1.55, duration: 1800, useNativeDriver: true }),
            Animated.timing(o, { toValue: 0, duration: 1800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(o, { toValue: 0.4, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
    const a1 = ring(scale1, opacity1, 0);
    const a2 = ring(scale2, opacity2, 700);
    a1.start();
    a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, [scale1, opacity1, scale2, opacity2]);

  return (
    <>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: scale1 }], opacity: opacity1 }]} />
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: scale2 }], opacity: opacity2 }]} />
    </>
  );
}

function FeedbackCard({
  feedback,
  loading,
}: {
  feedback: SessionFeedback | null;
  loading: boolean;
}) {
  if (!loading && !feedback) return null;
  return (
    <View style={styles.feedbackCard}>
      <Text style={styles.feedbackLabel}>IL TUO FEEDBACK</Text>
      {loading ? (
        <View style={styles.feedbackLoading}>
          <ActivityIndicator size="small" color="#d6baff" />
          <Text style={styles.feedbackLoadingText}>Analisi in corso...</Text>
        </View>
      ) : feedback ? (
        <View style={{ gap: 12 }}>
          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackEmoji}>💬</Text>
            <Text style={styles.feedbackPraise}>{feedback.praise}</Text>
          </View>
          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackEmoji}>💡</Text>
            <Text style={styles.feedbackTip}>{feedback.tip}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CorrectionsCard({ feedback }: { feedback: SessionFeedback }) {
  const hasCorrections = feedback.corrections.length > 0;
  const hasPatterns = feedback.patternsGood.length > 0 || feedback.patternsToImprove.length > 0;
  if (!hasCorrections && !hasPatterns) return null;

  return (
    <View style={styles.correctionsCard}>
      <Text style={styles.correctionsLabel}>ANALISI GRAMMATICALE</Text>

      {hasCorrections && (
        <View style={{ gap: 10, marginBottom: hasPatterns ? 16 : 0 }}>
          {feedback.corrections.map((c, i) => (
            <View key={i} style={styles.correctionRow}>
              <View style={styles.correctionOriginal}>
                <Text style={styles.correctionX}>✗</Text>
                <Text style={styles.correctionOriginalText}>"{c.original}"</Text>
              </View>
              <View style={styles.correctionArrowRow}>
                <Text style={styles.correctionArrow}>↓</Text>
                <View style={styles.correctionFixed}>
                  <Text style={styles.correctionCheck}>✓</Text>
                  <Text style={styles.correctionFixedText}>"{c.corrected}"</Text>
                </View>
              </View>
              <Text style={styles.correctionExplanation}>{c.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      {hasPatterns && (
        <View style={{ gap: 6 }}>
          {feedback.patternsGood.map((p, i) => (
            <View key={`g${i}`} style={styles.patternRow}>
              <Text style={styles.patternGoodDot}>✓</Text>
              <Text style={styles.patternGoodText}>{p}</Text>
            </View>
          ))}
          {feedback.patternsToImprove.map((p, i) => (
            <View key={`i${i}`} style={styles.patternRow}>
              <Text style={styles.patternImproveDot}>→</Text>
              <Text style={styles.patternImproveText}>{p}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SessionReview({
  turns,
  newVocabulary,
  feedback,
  feedbackLoading,
  onRepeat,
  onHome,
}: {
  turns: ConversationTurn[];
  newVocabulary: VocabItem[];
  feedback: SessionFeedback | null;
  feedbackLoading: boolean;
  onRepeat: () => void;
  onHome: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.reviewOverlay, { paddingBottom: insets.bottom + 24 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 }}>
        {/* Celebration */}
        <View style={styles.reviewHero}>
          <View style={styles.reviewBlob1} />
          <View style={styles.reviewBlob2} />
          <Text style={styles.reviewTitle}>Ottimo lavoro!</Text>
          <Text style={styles.reviewSub}>Hai completato la lezione con successo. Continua così!</Text>
          <Text style={{ fontSize: 64, marginTop: 16 }}>🎉</Text>
        </View>

        {/* Stats bento */}
        <View style={styles.statsBento}>
          <View style={styles.statCardOrange}>
            <Text style={{ fontSize: 20, color: "#380d00" }}>💬</Text>
            <Text style={styles.statCardTitle}>Scambi</Text>
            <Text style={styles.statCardNum}>{turns.length}</Text>
            <Text style={[styles.statCardSub, { color: "#380d00" }]}>Turni di Dialogo</Text>
          </View>
          <View style={styles.statCardYellow}>
            <Text style={{ fontSize: 20, color: "#373100" }}>📖</Text>
            <Text style={[styles.statCardTitle, { color: "#373100" }]}>Termini</Text>
            <Text style={[styles.statCardNum, { color: "#373100" }]}>+{newVocabulary.length}</Text>
            <Text style={styles.statCardSub}>Nuovi Acquisiti</Text>
          </View>
        </View>

        {/* AI Feedback */}
        <FeedbackCard feedback={feedback} loading={feedbackLoading} />

        {/* Grammar corrections */}
        {!feedbackLoading && feedback && <CorrectionsCard feedback={feedback} />}

        {/* Encountered vocabulary */}
        {newVocabulary.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <Text style={styles.reviewSectionLabel}>VOCABOLARIO ACQUISITO</Text>
            <View style={{ gap: 8 }}>
              {newVocabulary.map((v, i) => (
                <View key={i} style={styles.vocabRow}>
                  <View style={styles.vocabIcon}>
                    <Text style={{ color: "#d6baff", fontSize: 18 }}>🔤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vocabItalian}>{v.italian}</Text>
                    <Text style={styles.vocabEnglish}>{v.english}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity onPress={onRepeat} style={styles.repeatBtn} activeOpacity={0.85}>
          <Text style={styles.repeatBtnText}>↺  Ripeti Scenario</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onHome} style={styles.homeBtn} activeOpacity={0.85}>
          <Text style={styles.homeBtnText}>🏠  Torna alla Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function ConversationScreen() {
  const { id, scenarioData } = useLocalSearchParams<{ id: string; scenarioData: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scenario: Scenario = JSON.parse(decodeURIComponent(scenarioData ?? "{}"));

  const { user } = useAuth();
  const { level } = usePreferences(user?.id);
  const [showSidekick, setShowSidekick] = useState(false);
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const { status, turns, partialTranscript, lastUserTranscript, activeVocab, isModelSpeaking, start, startTalking, stopTalking, end } = useConversation(scenario);
  const { messages: sidekickMessages, loading: sidekickLoading, ask } = useSidekick(scenario, turns);

  const newVocabulary = useMemo((): VocabItem[] =>
    scenario.vocabulary
      .filter((v) =>
        turns.some((t) => t.role === "assistant" && t.italian.toLowerCase().includes(v.italian.toLowerCase()))
      )
      .map((v) => ({
        ...v,
        activelyUsed: turns.some(
          (t) => t.role === "user" && t.italian.toLowerCase().includes(v.italian.toLowerCase())
        ),
      })),
    [turns, scenario.vocabulary]
  );

  const lastAiTurn = [...turns].reverse().find((t) => t.role === "assistant");

  const handleStart = useCallback(async () => {
    try {
      await start();
    } catch {
      Alert.alert("Connection Error", "Could not connect to the conversation server.");
    }
  }, [start]);

  useEffect(() => {
    handleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = useCallback(async () => {
    await end();
    const userId = user?.id ?? "";

    // Don't persist drive-by taps (< 2 turns means nothing meaningful happened)
    if (turns.length < 2) return;

    const sessionId = await saveSession({
      scenarioId: id,
      userId,
      turns,
      startedAt: turns[0]?.timestamp ?? Date.now(),
      endedAt: Date.now(),
      newVocabulary,
    }).catch(() => null);
    sessionIdRef.current = sessionId;
    upsertVocabulary(userId, newVocabulary).catch(() => {});

    // Request AI feedback if the user spoke at least once
    const userTurnCount = turns.filter((t) => t.role === "user").length;
    if (userTurnCount >= 1) {
      setFeedbackLoading(true);
      requestFeedback(turns, scenario, level)
        .then((fb) => {
          setFeedback(fb);
          if (sessionIdRef.current) {
            updateSessionFeedback(sessionIdRef.current, fb).catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => setFeedbackLoading(false));
    }
  }, [end, id, turns, newVocabulary, user, scenario, level]);

  const handleConfirmEnd = useCallback(() => {
    Alert.alert(
      "Termina conversazione?",
      "Il progresso sarà salvato.",
      [
        { text: "Continua", style: "cancel" },
        { text: "Termina", style: "destructive", onPress: handleEnd },
      ]
    );
  }, [handleEnd]);

  const handleHome = useCallback(() => {
    router.back();
  }, [router]);

  const handleRepeat = useCallback(() => {
    router.replace(
      `/conversation/${scenario.id}?scenarioData=${encodeURIComponent(JSON.stringify(scenario))}`
    );
  }, [router, scenario]);

  const isConnected = status === "active" || status === "thinking" || status === "talking";
  const isTalking = status === "talking";
  const isThinking = status === "thinking";
  const isEnded = status === "ended";

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.7}
            />
            <Text style={styles.logo}>L'Italiano</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, {
              backgroundColor: isTalking ? "#ff6d33" : isThinking ? "#7b5ea7" : isModelSpeaking ? "#dcc841" : isConnected ? "#4caf50" : "#594139"
            }]} />
            <Text style={styles.statusText}>
              {status === "idle" ? "Pronto"
                : status === "connecting" ? "Connessione..."
                : isTalking ? "Tocco tuo"
                : isThinking ? "Sto elaborando"
                : isModelSpeaking ? "Sta parlando"
                : isConnected ? "Turno tuo"
                : "Fine"}
            </Text>
          </View>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          <View style={styles.avatarOuter}>
            <PulseRings />
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 72 }}>🗣️</Text>
            </View>
            <View style={styles.waveWrap}>
              <AudioWaveform active={isConnected} color={isTalking ? "#ff6d33" : isModelSpeaking ? "#dcc841" : "#594139"} />
            </View>
          </View>

          {(partialTranscript || lastAiTurn) && isConnected ? (
            <View style={styles.speechContent}>
              <Text style={styles.speakerLabel}>{scenario.characterName.toUpperCase()}</Text>
              <Text style={styles.speechItalian}>"{partialTranscript || lastAiTurn!.italian}"</Text>
            </View>
          ) : (
            <View style={styles.idleContent}>
              <Text style={styles.characterName}>{scenario.characterName}</Text>
              <Text style={styles.settingText}>{scenario.setting}</Text>
            </View>
          )}

          {isConnected && (
            <View style={[styles.listeningPill, isTalking && styles.talkingPill, isThinking && styles.thinkingPill, isModelSpeaking && styles.modelPill]}>
              <View style={[styles.listeningDot,
                isTalking && { backgroundColor: "#ff6d33" },
                isThinking && { backgroundColor: "#7b5ea7" },
                isModelSpeaking && { backgroundColor: "#dcc841" },
              ]} />
              <Text style={[styles.listeningText,
                isTalking && { color: "#ff6d33" },
                isThinking && { color: "#7b5ea7" },
                isModelSpeaking && { color: "#dcc841" },
              ]}>
                {isTalking ? "STAI PARLANDO..."
                  : isThinking ? "STA ELABORANDO..."
                  : isModelSpeaking ? "STA RISPONDENDO..."
                  : "TIENI PREMUTO PER PARLARE"}
              </Text>
            </View>
          )}

          {isConnected && !isTalking && !!lastUserTranscript && (
            <View style={styles.hoSentitoPill}>
              <Text style={styles.hoSentitoText}>Ho sentito: «{lastUserTranscript}»</Text>
            </View>
          )}
        </View>

        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <VocabHint item={activeVocab} />
        </View>

        {/* Control bar */}
        <View style={[styles.controlBar, { paddingBottom: insets.bottom + 24 }]}>
          {status === "idle" || status === "connecting" ? (
            <View style={styles.connectingBar}>
              <ActivityIndicator size="small" color="#ff6d33" />
              <Text style={styles.connectingText}>Connessione in corso...</Text>
            </View>
          ) : (
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={() => setShowSidekick(true)}
                style={styles.sideBtn}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 22, color: "#e1bfb4" }}>💡</Text>
                <Text style={styles.sideBtnLabel}>Aiuto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPressIn={startTalking}
                onPressOut={stopTalking}
                disabled={status === "ended" || isModelSpeaking || isThinking}
                style={[
                  styles.micMainBtn,
                  isTalking && styles.micMainBtnActive,
                  isModelSpeaking && { opacity: 0.4 },
                ]}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 32 }}>🎙️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={isEnded ? handleHome : handleConfirmEnd}
                style={styles.sideBtn}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 22, color: "#e1bfb4" }}>✕</Text>
                <Text style={styles.sideBtnLabel}>Chiudi</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Session review overlay */}
      {isEnded && (
        <SessionReview
          turns={turns}
          newVocabulary={newVocabulary}
          feedback={feedback}
          feedbackLoading={feedbackLoading}
          onRepeat={handleRepeat}
          onHome={handleHome}
        />
      )}

      {showSidekick && (
        <Sidekick
          messages={sidekickMessages}
          loading={sidekickLoading}
          onAsk={ask}
          onClose={() => setShowSidekick(false)}
        />
      )}
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
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#594139" },
  logo: { fontSize: 20, fontWeight: "800", color: "#ffb59b" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#201f1f", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700", color: "#e1bfb4" },
  main: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  avatarOuter: {
    width: 192,
    height: 192,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  pulseRing: {
    position: "absolute",
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: "#ff6d33",
  },
  avatarCircle: {
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: "#201f1f",
    borderWidth: 3,
    borderColor: "rgba(255,109,51,0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  waveWrap: {
    position: "absolute",
    bottom: -22,
    zIndex: 2,
    backgroundColor: "rgba(42,42,42,0.95)",
    borderRadius: 50,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#594139",
  },
  idleContent: { alignItems: "center", gap: 8 },
  characterName: { fontSize: 26, fontWeight: "700", color: "#e5e2e1", textAlign: "center" },
  settingText: { fontSize: 15, color: "#e1bfb4", textAlign: "center" },
  speechContent: { alignItems: "center", maxWidth: "100%", gap: 12 },
  speakerLabel: { fontSize: 11, fontWeight: "700", color: "#ffb59b", letterSpacing: 2, textTransform: "uppercase" },
  speechItalian: { fontSize: 28, fontStyle: "italic", color: "#e5e2e1", textAlign: "center", lineHeight: 38, fontWeight: "600" },
  speechEnglish: { fontSize: 15, color: "#e1bfb4", textAlign: "center", opacity: 0.7, lineHeight: 22 },
  listeningPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,109,51,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,109,51,0.2)",
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 20,
  },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffb59b" },
  listeningText: { fontSize: 11, fontWeight: "700", color: "#ffb59b", letterSpacing: 3 },
  controlBar: { paddingHorizontal: 24, paddingTop: 8 },
  connectingBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  connectingText: { fontSize: 15, fontWeight: "600", color: "#e1bfb4" },
  controls: {
    backgroundColor: "rgba(32,31,31,0.8)",
    borderRadius: 50,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#594139",
  },
  sideBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", gap: 4 },
  sideBtnLabel: { fontSize: 10, fontWeight: "700", color: "#e1bfb4" },
  micMainBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ff6d33",
    alignItems: "center",
    justifyContent: "center",
  },
  micMainBtnActive: {
    backgroundColor: "#c44a1a",
    transform: [{ scale: 1.1 }],
  },
  talkingPill: { backgroundColor: "rgba(255,109,51,0.1)", borderColor: "rgba(255,109,51,0.3)" },
  thinkingPill: { backgroundColor: "rgba(123,94,167,0.1)", borderColor: "rgba(123,94,167,0.3)" },
  modelPill: { backgroundColor: "rgba(220,200,65,0.1)", borderColor: "rgba(220,200,65,0.3)" },
  // Session review
  reviewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#131313", zIndex: 100 },
  reviewHero: {
    backgroundColor: "#53397c",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 20,
  },
  reviewBlob1: { position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(214,186,255,0.15)" },
  reviewBlob2: { position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,181,155,0.15)" },
  reviewTitle: { fontSize: 28, fontWeight: "800", color: "#c5a8f3", textAlign: "center", zIndex: 1 },
  reviewSub: { fontSize: 15, color: "rgba(197,168,243,0.8)", textAlign: "center", marginTop: 8, zIndex: 1 },
  statsBento: { flexDirection: "row", gap: 16, marginBottom: 20 },
  statCardOrange: { flex: 1, backgroundColor: "#ff6d33", borderRadius: 20, padding: 20, gap: 8, aspectRatio: 1 },
  statCardYellow: { flex: 1, backgroundColor: "#dcc841", borderRadius: 20, padding: 20, gap: 8, aspectRatio: 1 },
  statCardTitle: { fontSize: 18, fontWeight: "700", color: "#380d00" },
  statCardNum: { fontSize: 36, fontWeight: "800", color: "#380d00" },
  statCardSub: { fontSize: 10, fontWeight: "700", color: "#373100", textTransform: "uppercase", letterSpacing: 1 },
  reviewSectionLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 },
  vocabRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#201f1f", borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: "#594139" },
  vocabIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(214,186,255,0.1)", alignItems: "center", justifyContent: "center" },
  vocabItalian: { fontSize: 15, fontWeight: "700", color: "#e5e2e1" },
  vocabEnglish: { fontSize: 13, color: "#e1bfb4" },
  hoSentitoPill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
    maxWidth: "90%",
  },
  hoSentitoText: { fontSize: 13, color: "#e1bfb4", textAlign: "center", fontStyle: "italic", opacity: 0.75 },
  repeatBtn: { backgroundColor: "#ff6d33", borderRadius: 50, paddingVertical: 20, alignItems: "center", marginBottom: 16 },
  repeatBtnText: { fontSize: 16, fontWeight: "700", color: "#5f1b00" },
  homeBtn: { backgroundColor: "#353534", borderRadius: 50, paddingVertical: 20, alignItems: "center", borderWidth: 1, borderColor: "#594139" },
  homeBtnText: { fontSize: 16, fontWeight: "700", color: "#e5e2e1" },
  // Feedback card
  feedbackCard: {
    backgroundColor: "#1a1230",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(214,186,255,0.2)",
  },
  feedbackLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d6baff",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  feedbackLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  feedbackLoadingText: { fontSize: 14, color: "#a88a80", fontStyle: "italic" },
  feedbackRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  feedbackEmoji: { fontSize: 18, marginTop: 2 },
  feedbackPraise: { flex: 1, fontSize: 14, color: "#a8e4d4", lineHeight: 21, fontWeight: "500" },
  feedbackTip: { flex: 1, fontSize: 14, color: "#ffb59b", lineHeight: 21, fontWeight: "500" },
  // Corrections card
  correctionsCard: {
    backgroundColor: "#191311",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,109,51,0.15)",
  },
  correctionsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e1bfb4",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  correctionRow: {
    backgroundColor: "#201f1f",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#353534",
  },
  correctionOriginal: { flexDirection: "row", alignItems: "center", gap: 8 },
  correctionX: { fontSize: 12, color: "#ff6b6b", fontWeight: "700" },
  correctionOriginalText: { fontSize: 14, color: "#ff6b6b", fontStyle: "italic" },
  correctionArrowRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 },
  correctionArrow: { fontSize: 12, color: "#594139" },
  correctionFixed: { flexDirection: "row", alignItems: "center", gap: 8 },
  correctionCheck: { fontSize: 12, color: "#66d17a", fontWeight: "700" },
  correctionFixedText: { fontSize: 14, color: "#66d17a", fontWeight: "600", fontStyle: "italic" },
  correctionExplanation: { fontSize: 12, color: "#a88a80", lineHeight: 18, paddingTop: 2 },
  patternRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  patternGoodDot: { fontSize: 13, color: "#66d17a", fontWeight: "700", marginTop: 1 },
  patternGoodText: { flex: 1, fontSize: 13, color: "#66d17a", lineHeight: 19 },
  patternImproveDot: { fontSize: 13, color: "#dcc841", fontWeight: "700", marginTop: 1 },
  patternImproveText: { flex: 1, fontSize: 13, color: "#dcc841", lineHeight: 19 },
});
