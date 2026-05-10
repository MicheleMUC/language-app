import { useState } from "react";
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

  const handleSubmit = () => {
    if (!question.trim() || loading) return;
    onAsk(question.trim());
    setQuestion("");
  };

  return (
    <Modal visible animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.sheet, { paddingBottom: insets.bottom }]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sidekick</Text>
              <Text style={styles.subtitle}>Ask me anything about the conversation</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.doneBtn}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView style={styles.messages} showsVerticalScrollIndicator={false}>
            {messages.length === 0 && (
              <Text style={styles.hint}>
                Try asking:{"\n"}"Why did they use 'vorrei' here?"{"\n"}"How do I say 'I prefer the big one'?"
              </Text>
            )}
            {messages.map((msg, i) => (
              <View key={i} style={styles.msgGroup}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{msg.question}</Text>
                </View>
                <View style={styles.aiBubble}>
                  <Text style={styles.aiText}>{msg.answer}</Text>
                </View>
              </View>
            ))}
            {loading && <ActivityIndicator color="#7C3AED" style={{ marginBottom: 12 }} />}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask in English..."
              placeholderTextColor="#C4B5FD"
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#F9F5FF", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  handleRow: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#C4B5FD" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EDE9FE" },
  title: { fontSize: 18, fontWeight: "700", color: "#7C3AED" },
  subtitle: { fontSize: 12, color: "#A78BFA" },
  doneBtn: { color: "#A78BFA", fontSize: 15 },
  messages: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  hint: { color: "#C4B5FD", fontSize: 13, textAlign: "center", paddingTop: 24, lineHeight: 22 },
  msgGroup: { marginBottom: 16 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#fff", borderWidth: 1, borderColor: "#EDE9FE", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, maxWidth: "85%" },
  userText: { color: "#4C1D95", fontSize: 13 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#7C3AED", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, maxWidth: "90%" },
  aiText: { color: "#fff", fontSize: 13, lineHeight: 20 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: "#EDE9FE", gap: 8 },
  input: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDD6FE", borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 14, color: "#1F2937", maxHeight: 96 },
  sendBtn: { backgroundColor: "#7C3AED", borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#DDD6FE" },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
