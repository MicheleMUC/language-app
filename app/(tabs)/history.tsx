import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { FloatingNav } from "@/components/FloatingNav";
import { db } from "@/lib/firebase";
import type { ConversationSession } from "@/types";

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const load = async () => {
      if (!db) { setLoading(false); return; }
      try {
        const q = query(collection(db, "sessions"), orderBy("startedAt", "desc"), limit(20));
        const snap = await getDocs(q);
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConversationSession)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar} />
          <Text style={styles.logo}>L'Italiano</Text>
          <View style={styles.bellBtn}>
            <Text style={{ fontSize: 18, color: "#ffb59b" }}>🔔</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={styles.pageLabel}>Storico</Text>
          <Text style={styles.pageTitle}>Le tue sessioni</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.mutedText}>Caricamento...</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.centered}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📚</Text>
            <Text style={styles.emptyTitle}>Nessuna conversazione</Text>
            <Text style={styles.emptyText}>
              Completa la tua prima conversazione italiana per vederla qui.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 100 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.sessionCard} activeOpacity={0.8}>
                <View style={styles.sessionIcon}>
                  <Text style={{ fontSize: 22 }}>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle} numberOfLines={2}>
                    {item.turns[0]?.italian ?? "Conversazione"}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {item.turns.length} turni · {item.newVocabulary.length} parole nuove
                  </Text>
                </View>
                <View style={styles.sessionDate}>
                  <Text style={styles.sessionDateText}>
                    {new Date(item.startedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>

      <FloatingNav active="history" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#53397c", borderWidth: 2, borderColor: "#ffb59b" },
  logo: { flex: 1, fontSize: 24, fontWeight: "800", color: "#ffb59b" },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center" },
  pageLabel: { fontSize: 11, fontWeight: "700", color: "#d6baff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 },
  pageTitle: { fontSize: 32, fontWeight: "800", color: "#e5e2e1" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  mutedText: { color: "#594139", fontSize: 15 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#e5e2e1", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, color: "#e1bfb4", textAlign: "center", lineHeight: 22 },
  sessionCard: {
    backgroundColor: "#201f1f",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#353534",
  },
  sessionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#53397c", alignItems: "center", justifyContent: "center" },
  sessionTitle: { fontSize: 15, fontWeight: "600", color: "#e5e2e1", marginBottom: 4 },
  sessionMeta: { fontSize: 12, color: "#e1bfb4" },
  sessionDate: { backgroundColor: "#2a2a2a", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  sessionDateText: { fontSize: 11, fontWeight: "700", color: "#ffb59b" },
});
