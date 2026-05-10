import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { IntentForm } from "@/components/IntentForm";
import { ScenarioCard } from "@/components/ScenarioCard";
import { generateScenario } from "@/lib/api";
import { db } from "@/lib/firebase";
import type { Scenario } from "@/types";

export default function HomeScreen() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleIntent = async (intent: string) => {
    setLoading(true);
    try {
      const generated = await generateScenario(intent, "anonymous");
      let id = `local_${Date.now()}`;
      if (db) {
        const docRef = await addDoc(collection(db, "scenarios"), generated);
        id = docRef.id;
      }
      setScenario({ ...generated, id });
    } catch (e) {
      Alert.alert("Error", "Could not generate scenario. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (!scenario) return;
    router.push(`/conversation/${scenario.id}?scenarioData=${encodeURIComponent(JSON.stringify(scenario))}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6 pb-2">
        <Text className="text-xl font-bold text-gray-900">🇮🇹 Italian Practice</Text>
      </View>
      {scenario ? (
        <>
          <ScenarioCard scenario={scenario} onStart={handleStart} />
          <View className="px-6 pb-4">
            <Text
              className="text-center text-sm text-blue-500"
              onPress={() => setScenario(null)}
            >
              ← Try a different scenario
            </Text>
          </View>
        </>
      ) : (
        <IntentForm onSubmit={handleIntent} loading={loading} />
      )}
    </SafeAreaView>
  );
}
