import { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SidekickMessage } from "@/types";

interface Props {
  messages: SidekickMessage[];
  loading: boolean;
  onAsk: (question: string) => void;
  onClose: () => void;
}

export function Sidekick({ messages, loading, onAsk, onClose }: Props) {
  const [question, setQuestion] = useState("");
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const handleSubmit = () => {
    if (!question.trim() || loading) return;
    onAsk(question.trim());
    setQuestion("");
  };

  const lastMessage = messages[messages.length - 1];

  return (
    <Modal
      visible
      animationType="none"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%" }}
        >
          <Animated.View
            style={[
              styles.card,
              { paddingBottom: insets.bottom + 16 },
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* PRO TIP badge + icon */}
            <View style={styles.badgeRow}>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO TIP</Text>
              </View>
              <Text style={{ fontSize: 20 }}>💡</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>AI Sidekick</Text>

            {/* Explanation card (last AI answer or hint) */}
            {lastMessage ? (
              <View style={styles.explanationCard}>
                <Text style={styles.explanationQuestion}>{lastMessage.question}</Text>
                <Text style={styles.explanationAnswer}>{lastMessage.answer}</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.explanationCard}>
                <Text style={styles.hintText}>
                  Ask me anything about the conversation.{"\n\n"}
                  Try: "Why did they use 'vorrei' here?" or "How do I say 'I prefer the big one'?"
                </Text>
              </View>
            ) : null}

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#dcc841" />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            )}

            {/* Past messages (scrollable if more than 1) */}
            {messages.length > 1 && (
              <ScrollView style={styles.history} showsVerticalScrollIndicator={false}>
                {messages.slice(0, -1).reverse().map((msg, i) => (
                  <View key={i} style={styles.historyItem}>
                    <Text style={styles.historyQ}>{msg.question}</Text>
                    <Text style={styles.historyA}>{msg.answer}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Input row */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask in English..."
                placeholderTextColor="#c5a8f3"
                multiline
                value={question}
                onChangeText={setQuestion}
              />
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!question.trim() || loading}
                style={[styles.sendBtn, (!question.trim() || loading) && styles.sendBtnDisabled]}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            </View>

            {/* Close button */}
            <TouchableOpacity onPress={onClose} style={styles.capito} activeOpacity={0.85}>
              <Text style={styles.capitoText}>Capito!  ✓</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(19,19,19,0.7)",
  },
  card: {
    backgroundColor: "#53397c",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(214,186,255,0.2)",
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  proBadge: {
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  proBadgeText: { fontSize: 11, fontWeight: "700", color: "#5f1b00", letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: "800", color: "#c5a8f3", marginBottom: 16 },
  explanationCard: {
    backgroundColor: "rgba(42,42,42,0.8)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#dcc841",
  },
  explanationQuestion: { fontSize: 14, fontWeight: "700", color: "#e5e2e1", marginBottom: 8 },
  explanationAnswer: { fontSize: 14, color: "#e1bfb4", lineHeight: 22 },
  hintText: { fontSize: 14, color: "#c5a8f3", lineHeight: 22 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  loadingText: { fontSize: 13, color: "#c5a8f3" },
  history: { maxHeight: 140, marginBottom: 12 },
  historyItem: { marginBottom: 12, opacity: 0.6 },
  historyQ: { fontSize: 12, fontWeight: "700", color: "#e5e2e1", marginBottom: 2 },
  historyA: { fontSize: 12, color: "#e1bfb4", lineHeight: 18 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 12,
    backgroundColor: "rgba(32,31,31,0.6)",
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(214,186,255,0.2)",
  },
  input: {
    flex: 1,
    color: "#e5e2e1",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 80,
  },
  sendBtn: {
    backgroundColor: "#ff6d33",
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "rgba(255,109,51,0.3)" },
  sendIcon: { color: "#5f1b00", fontSize: 18, fontWeight: "700" },
  capito: {
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
  },
  capitoText: { fontSize: 17, fontWeight: "700", color: "#5f1b00" },
});
