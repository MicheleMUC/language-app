import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, SafeAreaView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { AudioWaveform } from "@/components/AudioWaveform";
import { LiveTranscript } from "@/components/LiveTranscript";
import { VocabHint } from "@/components/VocabHint";
import { Sidekick } from "@/components/Sidekick";
import { useConversation } from "@/hooks/useConversation";
import { useSidekick } from "@/hooks/useSidekick";
import { db } from "@/lib/firebase";
import type { Scenario } from "@/types";

export default function ConversationScreen() {
  const { id, scenarioData } = useLocalSearchParams<{ id: string; scenarioData: string }>();
  const router = useRouter();
  const scenario: Scenario = JSON.parse(decodeURIComponent(scenarioData ?? "{}"));

  const [showSidekick, setShowSidekick] = useState(false);
  const { status, turns, activeVocab, start, pause, resume, end } = useConversation(scenario);
  const { messages: sidekickMessages, loading: sidekickLoading, ask } = useSidekick(scenario, turns);

  const handleStart = useCallback(async () => {
    try {
      await start();
    } catch {
      Alert.alert("Connection Error", "Could not connect to the conversation server.");
    }
  }, [start]);

  const handleSidekick = useCallback(() => {
    pause();
    setShowSidekick(true);
  }, [pause]);

  const handleSidekickClose = useCallback(async () => {
    setShowSidekick(false);
    await resume();
  }, [resume]);

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
    router.back();
  }, [end, id, turns, router]);

  const isActive = status === "active";
  const isConnecting = status === "connecting";

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-800">
        <View className="flex-1">
          <Text className="text-white font-semibold">{scenario.characterName}</Text>
          <Text className="text-gray-400 text-xs">{scenario.setting}</Text>
        </View>
        <View className={`rounded-full px-2 py-1 ${isActive ? "bg-green-500/20" : "bg-gray-700"}`}>
          <Text className={`text-xs ${isActive ? "text-green-400" : "text-gray-400"}`}>
            {status === "idle" ? "Ready" : status === "connecting" ? "Connecting..." : status}
          </Text>
        </View>
      </View>

      {/* Vocab hint overlay */}
      <View className="relative">
        <VocabHint item={activeVocab} />
      </View>

      {/* Transcript */}
      <LiveTranscript turns={turns} />

      {/* Waveform */}
      <View className="items-center py-6">
        <AudioWaveform active={isActive} color="#60A5FA" />
      </View>

      {/* Controls */}
      {status === "idle" ? (
        <View className="px-6 pb-6">
          <TouchableOpacity
            onPress={handleStart}
            className="bg-primary rounded-2xl py-4 items-center"
          >
            <Text className="text-white font-semibold text-base">Start Speaking</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row items-center justify-center gap-4 pb-6 px-6">
          <TouchableOpacity
            onPress={handleSidekick}
            disabled={isConnecting || status === "ended"}
            className="bg-sidekick rounded-2xl px-5 py-3 flex-1 items-center"
          >
            <Text className="text-white font-semibold">🤖 Sidekick</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEnd}
            className="bg-red-500/20 border border-red-500/40 rounded-2xl px-5 py-3 flex-1 items-center"
          >
            <Text className="text-red-400 font-semibold">End</Text>
          </TouchableOpacity>
        </View>
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
    </SafeAreaView>
  );
}
