import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingNav } from "@/components/FloatingNav";
import { loadVocabulary } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { VocabItem } from "@/types";

type VocabEntry = VocabItem & { firstSeenAt: string; activelyUsed: boolean };

export default function VocabularyScreen() {
  const { user } = useAuth();
  const [words, setWords] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user) return;
    loadVocabulary(user.id)
      .then(setWords)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.pageLabel}>Vocabolario</Text>
            <Text style={styles.pageTitle}>Il Mio Vocabolario</Text>
          </View>
          {!loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {words.filter((w) => w.activelyUsed).length} / {words.length}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.mutedText}>Caricamento...</Text>
          </View>
        ) : words.length === 0 ? (
          <View style={styles.centered}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📖</Text>
            <Text style={styles.emptyTitle}>Nessuna parola ancora</Text>
            <Text style={styles.emptyText}>
              Completa la tua prima conversazione per iniziare a costruire il tuo vocabolario!
            </Text>
          </View>
        ) : (
          <FlatList
            data={words}
            keyExtractor={(item) => item.italian}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: insets.bottom + 100,
              paddingTop: 8,
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <View style={styles.wordCard}>
                <View style={[styles.wordIcon, item.activelyUsed ? styles.wordIconActive : styles.wordIconPassive]}>
                  <Text style={{ fontSize: 18 }}>{item.activelyUsed ? "🗣️" : "👂"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.italian}>{item.italian}</Text>
                  <Text style={styles.english}>{item.english}</Text>
                  {!!item.example && (
                    <Text style={styles.example}>"{item.example}"</Text>
                  )}
                  <View style={item.activelyUsed ? styles.activeBadge : styles.passiveBadge}>
                    <Text style={item.activelyUsed ? styles.activeBadgeText : styles.passiveBadgeText}>
                      {item.activelyUsed ? "attivo" : "passivo"}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>

      <FloatingNav active="vocabulary" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  pageLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d6baff",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  pageTitle: { fontSize: 32, fontWeight: "800", color: "#e5e2e1" },
  countBadge: {
    backgroundColor: "#53397c",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  countText: { fontSize: 16, fontWeight: "800", color: "#d6baff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  mutedText: { color: "#594139", fontSize: 15 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#e5e2e1", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, color: "#e1bfb4", textAlign: "center", lineHeight: 22 },
  wordCard: {
    backgroundColor: "#201f1f",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: "#353534",
  },
  wordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  wordIconActive: { backgroundColor: "rgba(255,109,51,0.12)" },
  wordIconPassive: { backgroundColor: "rgba(214,186,255,0.1)" },
  activeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,109,51,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,109,51,0.3)",
    marginTop: 6,
  },
  activeBadgeText: { fontSize: 11, fontWeight: "700", color: "#ff6d33" },
  passiveBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(83,57,124,0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(214,186,255,0.2)",
    marginTop: 6,
  },
  passiveBadgeText: { fontSize: 11, fontWeight: "700", color: "#9d7ec5" },
  italian: { fontSize: 17, fontWeight: "700", color: "#e5e2e1", marginBottom: 2 },
  english: { fontSize: 14, color: "#e1bfb4", marginBottom: 4 },
  example: { fontSize: 13, color: "#a88a80", fontStyle: "italic", lineHeight: 18 },
});
