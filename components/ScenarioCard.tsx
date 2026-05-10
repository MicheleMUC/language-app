import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import type { Scenario } from "@/types";

interface Props {
  scenario: Scenario;
  onStart: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-700",
  A2: "bg-green-100 text-green-700",
  B1: "bg-yellow-100 text-yellow-700",
  B2: "bg-orange-100 text-orange-700",
  C1: "bg-red-100 text-red-700",
  C2: "bg-red-100 text-red-700",
};

export function ScenarioCard({ scenario, onStart }: Props) {
  const diffColor = DIFFICULTY_COLORS[scenario.difficulty] ?? "bg-gray-100 text-gray-700";

  return (
    <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="flex-row items-center justify-between mt-6 mb-4">
        <Text className="text-2xl font-bold text-gray-900">Your Scenario</Text>
        <View className={`rounded-full px-3 py-1 ${diffColor.split(" ")[0]}`}>
          <Text className={`text-xs font-semibold ${diffColor.split(" ")[1]}`}>
            {scenario.difficulty}
          </Text>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
        <Text className="text-sm text-gray-500 mb-1">You are talking to</Text>
        <Text className="text-lg font-semibold text-gray-900">{scenario.characterName}</Text>
        <Text className="text-sm text-gray-600 mt-1">{scenario.characterDescription}</Text>
      </View>

      <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
        <Text className="text-sm text-gray-500 mb-1">Setting</Text>
        <Text className="text-base text-gray-800">{scenario.setting}</Text>
      </View>

      <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
        <Text className="text-sm font-semibold text-gray-700 mb-3">Key Vocabulary</Text>
        {scenario.vocabulary.map((v) => (
          <View key={v.italian} className="flex-row justify-between items-center py-1.5 border-b border-gray-50">
            <Text className="text-base font-medium text-gray-900">{v.italian}</Text>
            <Text className="text-sm text-gray-500">{v.english}</Text>
          </View>
        ))}
      </View>

      <View className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-100">
        <Text className="text-sm font-semibold text-blue-700 mb-2">Phrases to listen for</Text>
        {scenario.likelyPhrases.map((p) => (
          <Text key={p} className="text-sm text-blue-600 py-0.5">• {p}</Text>
        ))}
      </View>

      <TouchableOpacity
        onPress={onStart}
        className="bg-primary rounded-2xl py-4 items-center"
      >
        <Text className="text-white text-base font-semibold">Start Conversation</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
