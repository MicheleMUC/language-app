import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";

interface Props {
  onSubmit: (intent: string) => void;
  loading: boolean;
}

export function IntentForm({ onSubmit, loading }: Props) {
  const [intent, setIntent] = useState("");

  const examples = [
    "Chat with my Italian neighbors",
    "Order food at a restaurant in Rome",
    "Buy vegetables at a local market",
    "Ask for directions in a small town",
  ];

  return (
    <View className="flex-1 px-6 pt-8">
      <Text className="text-3xl font-bold text-gray-900 mb-2">What do you want to practice?</Text>
      <Text className="text-base text-gray-500 mb-6">
        Describe a real-life situation and we'll simulate it in Italian.
      </Text>

      <TextInput
        className="bg-white border border-gray-200 rounded-2xl p-4 text-base text-gray-900 min-h-[100px]"
        placeholder="e.g. I want to talk to my Italian neighbors about the weather..."
        placeholderTextColor="#9CA3AF"
        multiline
        value={intent}
        onChangeText={setIntent}
        textAlignVertical="top"
      />

      <Text className="text-sm text-gray-400 mt-4 mb-2">Try one of these:</Text>
      <View className="flex-row flex-wrap gap-2 mb-8">
        {examples.map((ex) => (
          <TouchableOpacity
            key={ex}
            onPress={() => setIntent(ex)}
            className="bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5"
          >
            <Text className="text-blue-700 text-sm">{ex}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => intent.trim() && onSubmit(intent.trim())}
        disabled={!intent.trim() || loading}
        className={`rounded-2xl py-4 items-center ${
          intent.trim() && !loading ? "bg-primary" : "bg-gray-200"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className={`text-base font-semibold ${intent.trim() ? "text-white" : "text-gray-400"}`}>
            Create Scenario
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
