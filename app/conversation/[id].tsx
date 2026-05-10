import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { AudioWaveform } from "@/components/AudioWaveform";
import { VocabHint } from "@/components/VocabHint";
import { Sidekick } from "@/components/Sidekick";
import { useConversation } from "@/hooks/useConversation";
import { useSidekick } from "@/hooks/useSidekick";
import { db } from "@/lib/firebase";
import type { Scenario, ConversationTurn } from "@/types";

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

function SessionReview({ turns, onRepeat, onHome }: { turns: ConversationTurn[]; onRepeat: () => void; onHome: () => void }) {
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
            <Text style={{ fontSize: 20, color: "#380d00" }}>✨</Text>
            <Text style={styles.statCardTitle}>Fluidità</Text>
            <Text style={styles.statCardNum}>85%</Text>
            <View style={styles.statBar}>
              <View style={[styles.statBarFill, { width: "85%" }]} />
            </View>
          </View>
          <View style={styles.statCardYellow}>
            <Text style={{ fontSize: 20, color: "#373100" }}>📖</Text>
            <Text style={[styles.statCardTitle, { color: "#373100" }]}>Termini</Text>
            <Text style={[styles.statCardNum, { color: "#373100" }]}>+{turns.length}</Text>
            <Text style={styles.statCardSub}>Nuovi Acquisiti</Text>
          </View>
        </View>

        {/* Vocab from turns */}
        {turns.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <Text style={styles.reviewSectionLabel}>VOCABOLARIO ACQUISITO</Text>
            <View style={{ gap: 8 }}>
              {turns.slice(0, 3).map((t, i) => (
                <View key={i} style={styles.vocabRow}>
                  <View style={styles.vocabIcon}>
                    <Text style={{ color: "#d6baff", fontSize: 18 }}>🔤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vocabItalian} numberOfLines={1}>{t.italian}</Text>
                    {t.english && <Text style={styles.vocabEnglish} numberOfLines={1}>{t.english}</Text>}
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

  const [showSidekick, setShowSidekick] = useState(false);
  const { status, turns, activeVocab, start, startTalking, stopTalking, end } = useConversation(scenario);
  const { messages: sidekickMessages, loading: sidekickLoading, ask } = useSidekick(scenario, turns);

  const lastAiTurn = [...turns].reverse().find((t) => t.role === "assistant");

  const handleStart = useCallback(async () => {
    try {
      await start();
    } catch {
      Alert.alert("Connection Error", "Could not connect to the conversation server.");
    }
  }, [start]);

  const handleSidekick = useCallback(() => {
    setShowSidekick(true);
  }, []);

  const handleSidekickClose = useCallback(() => {
    setShowSidekick(false);
  }, []);

  const handleEnd = useCallback(async () => {
    await end();
    if (db) {
      await addDoc(collection(db, "sessions"), {
        scenarioId: id,
        userId: "anonymous",
        turns,
        startedAt: turns[0]?.timestamp ?? Date.now(),
        endedAt: Date.now(),
        newVocabulary: [],
      });
    }
  }, [end, id, turns]);

  const handleHome = useCallback(() => {
    router.back();
  }, [router]);

  const isConnected = status === "active" || status === "talking";
  const isTalking = status === "talking";
  const isEnded = status === "ended";

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar} />
            <Text style={styles.logo}>L'Italiano</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: isTalking ? "#ff6d33" : isConnected ? "#dcc841" : "#594139" }]} />
            <Text style={styles.statusText}>
              {status === "idle" ? "Pronto" : status === "connecting" ? "Connessione..." : isTalking ? "Stai parlando" : status === "active" ? "Ascolta" : "Fine"}
            </Text>
          </View>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          {/* Avatar with pulse rings */}
          <View style={styles.avatarOuter}>
            <PulseRings />
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 72 }}>🗣️</Text>
            </View>
            {/* Wave bars pill below avatar */}
            <View style={styles.waveWrap}>
              <AudioWaveform active={isConnected} color={isTalking ? "#dcc841" : "#ff6d33"} />
            </View>
          </View>

          {/* Speech text */}
          {lastAiTurn && isConnected ? (
            <View style={styles.speechContent}>
              <Text style={styles.speakerLabel}>{scenario.characterName.toUpperCase()}</Text>
              <Text style={styles.speechItalian}>"{lastAiTurn.italian}"</Text>
            </View>
          ) : (
            <View style={styles.idleContent}>
              <Text style={styles.characterName}>{scenario.characterName}</Text>
              <Text style={styles.settingText}>{scenario.setting}</Text>
            </View>
          )}

          {/* Status pill */}
          {isConnected && (
            <View style={[styles.listeningPill, isTalking && styles.talkingPill]}>
              <View style={[styles.listeningDot, isTalking && { backgroundColor: "#ff6d33" }]} />
              <Text style={[styles.listeningText, isTalking && { color: "#ff6d33" }]}>
                {isTalking ? "STAI PARLANDO..." : "TIENI PREMUTO PER PARLARE"}
              </Text>
            </View>
          )}
        </View>

        {/* VocabHint */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <VocabHint item={activeVocab} />
        </View>

        {/* Control bar */}
        <View style={[styles.controlBar, { paddingBottom: insets.bottom + 24 }]}>
          {status === "idle" || status === "connecting" ? (
            <TouchableOpacity
              onPress={handleStart}
              disabled={status === "connecting"}
              style={[styles.startBtn, status === "connecting" && { opacity: 0.6 }]}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnText}>
                {status === "connecting" ? "Connessione..." : "Inizia Conversazione  ▶"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={handleSidekick}
                style={styles.sideBtn}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 22, color: "#e1bfb4" }}>💡</Text>
                <Text style={styles.sideBtnLabel}>Aiuto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPressIn={startTalking}
                onPressOut={stopTalking}
                disabled={status === "ended"}
                style={[styles.micMainBtn, isTalking && styles.micMainBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 32 }}>🎙️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleEnd}
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
          onRepeat={handleHome}
          onHome={handleHome}
        />
      )}

      {/* Sidekick panel */}
      {showSidekick && (
        <Sidekick
          messages={sidekickMessages}
          loading={sidekickLoading}
          onAsk={ask}
          onClose={handleSidekickClose}
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
  startBtn: { backgroundColor: "#ff6d33", borderRadius: 50, paddingVertical: 20, alignItems: "center" },
  startBtnText: { fontSize: 17, fontWeight: "700", color: "#5f1b00" },
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
  talkingPill: {
    backgroundColor: "rgba(255,109,51,0.1)",
    borderColor: "rgba(255,109,51,0.3)",
  },
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
  statBar: { height: 8, backgroundColor: "rgba(56,13,0,0.2)", borderRadius: 4, overflow: "hidden" },
  statBarFill: { height: "100%", backgroundColor: "#380d00", borderRadius: 4 },
  reviewSectionLabel: { fontSize: 11, fontWeight: "700", color: "#e1bfb4", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 },
  vocabRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#201f1f", borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: "#594139" },
  vocabIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(214,186,255,0.1)", alignItems: "center", justifyContent: "center" },
  vocabItalian: { fontSize: 15, fontWeight: "700", color: "#e5e2e1" },
  vocabEnglish: { fontSize: 13, color: "#e1bfb4" },
  repeatBtn: { backgroundColor: "#ff6d33", borderRadius: 50, paddingVertical: 20, alignItems: "center", marginBottom: 16 },
  repeatBtnText: { fontSize: 16, fontWeight: "700", color: "#5f1b00" },
  homeBtn: { backgroundColor: "#353534", borderRadius: 50, paddingVertical: 20, alignItems: "center", borderWidth: 1, borderColor: "#594139" },
  homeBtnText: { fontSize: 16, fontWeight: "700", color: "#e5e2e1" },
});
