import { useRef, useEffect } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import type { ConversationTurn } from "@/types";

interface Props {
  turns: ConversationTurn[];
}

export function LiveTranscript({ turns }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns]);

  if (turns.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>La conversazione apparirà qui...</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
      {turns.map((turn, i) => (
        <View
          key={i}
          style={[styles.bubble, turn.role === "user" ? styles.userWrap : styles.aiWrap]}
        >
          <View style={turn.role === "user" ? styles.userBubble : styles.aiBubble}>
            <Text style={turn.role === "user" ? styles.userText : styles.aiText}>
              {turn.italian}
            </Text>
            {turn.english && (
              <Text style={turn.role === "user" ? styles.userSub : styles.aiSub}>
                {turn.english}
              </Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#594139", fontSize: 14 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  bubble: { marginBottom: 12, maxWidth: "85%" },
  userWrap: { alignSelf: "flex-end" },
  aiWrap: { alignSelf: "flex-start" },
  userBubble: { backgroundColor: "#ff6d33", borderRadius: 20, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 12 },
  aiBubble: { backgroundColor: "#201f1f", borderRadius: 20, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: "#353534" },
  userText: { fontSize: 15, fontWeight: "500", color: "#5f1b00" },
  aiText: { fontSize: 15, fontWeight: "500", color: "#e5e2e1" },
  userSub: { fontSize: 12, color: "rgba(95,27,0,0.7)", marginTop: 4 },
  aiSub: { fontSize: 12, color: "#e1bfb4", marginTop: 4 },
});
