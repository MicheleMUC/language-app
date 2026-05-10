import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import type { SidekickMessage } from "@/types";

interface Props {
  messages: SidekickMessage[];
  loading: boolean;
  onAsk: (question: string) => void;
  onClose: () => void;
}

export function Sidekick({ messages, loading, onAsk, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const [question, setQuestion] = useState("");
  const snapPoints = ["60%", "90%"];

  const handleSubmit = () => {
    if (!question.trim() || loading) return;
    onAsk(question.trim());
    setQuestion("");
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      onClose={onClose}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: "#7C3AED" }}
      backgroundStyle={{ backgroundColor: "#F9F5FF" }}
    >
      <BottomSheetView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-row items-center px-4 pb-3 border-b border-purple-100">
            <View className="flex-1">
              <Text className="text-lg font-bold text-sidekick">Sidekick</Text>
              <Text className="text-xs text-purple-400">Ask me anything about the conversation</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Text className="text-purple-400 text-base">Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-3" showsVerticalScrollIndicator={false}>
            {messages.length === 0 && (
              <View className="items-center pt-8">
                <Text className="text-purple-300 text-sm text-center">
                  Try asking:{"\n"}"Why did they use 'vorrei' here?"{"\n"}"How do I say 'I prefer the big one'?"
                </Text>
              </View>
            )}
            {messages.map((msg, i) => (
              <View key={i} className="mb-4">
                <View className="bg-white rounded-xl px-3 py-2 self-end mb-1 border border-purple-100">
                  <Text className="text-gray-700 text-sm">{msg.question}</Text>
                </View>
                <View className="bg-sidekick rounded-xl px-3 py-3 self-start max-w-[90%]">
                  <Text className="text-white text-sm leading-5">{msg.answer}</Text>
                </View>
              </View>
            ))}
            {loading && (
              <View className="self-start mb-4">
                <ActivityIndicator color="#7C3AED" />
              </View>
            )}
          </ScrollView>

          <View className="flex-row items-end px-4 py-3 border-t border-purple-100 gap-2">
            <TextInput
              className="flex-1 bg-white border border-purple-200 rounded-2xl px-4 py-3 text-sm text-gray-800 max-h-24"
              placeholder="Ask in English..."
              placeholderTextColor="#C4B5FD"
              multiline
              value={question}
              onChangeText={setQuestion}
            />
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!question.trim() || loading}
              className={`rounded-full w-10 h-10 items-center justify-center ${
                question.trim() && !loading ? "bg-sidekick" : "bg-purple-200"
              }`}
            >
              <Text className="text-white font-bold text-base">↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheetView>
    </BottomSheet>
  );
}
