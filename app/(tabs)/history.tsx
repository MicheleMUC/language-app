import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ConversationSession } from "@/types";

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!db) { setLoading(false); return; }
      try {
        const q = query(
          collection(db, "sessions"),
          orderBy("startedAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConversationSession)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-400">Loading history...</Text>
      </SafeAreaView>
    );
  }

  if (sessions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Text className="text-4xl mb-4">📚</Text>
        <Text className="text-xl font-semibold text-gray-700 mb-2">No conversations yet</Text>
        <Text className="text-sm text-gray-400 text-center">
          Complete your first Italian conversation to see it here.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6 pb-4">
        <Text className="text-xl font-bold text-gray-900">Practice History</Text>
      </View>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <TouchableOpacity className="bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row justify-between items-start">
              <Text className="text-base font-semibold text-gray-900 flex-1 mr-2">
                {item.turns[0]?.italian ?? "Conversation"}
              </Text>
              <Text className="text-xs text-gray-400">
                {new Date(item.startedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text className="text-sm text-gray-500 mt-1">
              {item.turns.length} turns · {item.newVocabulary.length} new words
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
