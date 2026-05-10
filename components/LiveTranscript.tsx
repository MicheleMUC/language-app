import { useRef, useEffect } from "react";
import { ScrollView, View, Text } from "react-native";
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
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-400 text-sm">Conversation will appear here...</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} className="flex-1 px-4" showsVerticalScrollIndicator={false}>
      {turns.map((turn, i) => (
        <View
          key={i}
          className={`mb-3 max-w-[85%] ${turn.role === "user" ? "self-end" : "self-start"}`}
        >
          <View
            className={`rounded-2xl px-4 py-3 ${
              turn.role === "user" ? "bg-primary" : "bg-white border border-gray-100"
            }`}
          >
            <Text
              className={`text-base font-medium ${
                turn.role === "user" ? "text-white" : "text-gray-900"
              }`}
            >
              {turn.italian}
            </Text>
            {turn.english && (
              <Text
                className={`text-xs mt-1 ${
                  turn.role === "user" ? "text-blue-100" : "text-gray-400"
                }`}
              >
                {turn.english}
              </Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
