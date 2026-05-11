import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { savePreferences } from "@/lib/supabase";

type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const LEVELS: Array<{
  label: Level;
  title: string;
  description: string;
  bg: string;
  text: string;
  badge: string;
}> = [
  { label: "A1", title: "Principiante", description: "Capisco poche parole", bg: "#2a2200", text: "#dcc841", badge: "#dcc841" },
  { label: "A2", title: "Elementare", description: "Posso presentarmi", bg: "#2a1e00", text: "#f0c060", badge: "#dcc841" },
  { label: "B1", title: "Intermedio", description: "Mi arrangio in italiano", bg: "#2a1200", text: "#ff9060", badge: "#ff6d33" },
  { label: "B2", title: "Avanzato", description: "Parlo abbastanza bene", bg: "#2a0e00", text: "#ff7a40", badge: "#ff6d33" },
  { label: "C1", title: "Esperto", description: "Parlo con scioltezza", bg: "#1a1230", text: "#c5a8f3", badge: "#53397c" },
  { label: "C2", title: "Madrelingua", description: "Come un madrelingua", bg: "#120d22", text: "#d6baff", badge: "#53397c" },
];

export default function OnboardingScreen() {
  const [selected, setSelected] = useState<Level | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleContinue = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      if (user?.id) await savePreferences(user.id, selected);
    } catch {
      // non-fatal — preference can be set later in profile
    }
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.logo}>L'Italiano</Text>
          <Text style={styles.heading}>Qual è il tuo livello?</Text>
          <Text style={styles.subheading}>
            Scegli il livello più vicino al tuo italiano attuale. Potrai cambiarlo in seguito.
          </Text>

          <View style={styles.grid}>
            {LEVELS.map((lvl) => {
              const isSelected = selected === lvl.label;
              return (
                <TouchableOpacity
                  key={lvl.label}
                  onPress={() => setSelected(lvl.label)}
                  style={[
                    styles.card,
                    { backgroundColor: lvl.bg },
                    isSelected && styles.cardSelected,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.badge, { backgroundColor: lvl.badge }]}>
                    <Text style={styles.badgeText}>{lvl.label}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: lvl.text }]}>{lvl.title}</Text>
                  <Text style={[styles.cardDesc, { color: lvl.text, opacity: 0.75 }]}>
                    {lvl.description}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Text style={{ fontSize: 16 }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            disabled={!selected || saving}
            style={[styles.continueBtn, (!selected || saving) && { opacity: 0.4 }]}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#5f1b00" />
            ) : (
              <Text style={styles.continueBtnText}>Inizia a praticare →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(tabs)")}
            style={styles.skipLink}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Salta per ora</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#131313" },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: "center",
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffb59b",
    marginBottom: 32,
  },
  heading: {
    fontSize: 32,
    fontWeight: "800",
    color: "#e5e2e1",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    color: "#e1bfb4",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 280,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    width: "100%",
    marginBottom: 32,
  },
  card: {
    width: "47%",
    borderRadius: 20,
    padding: 20,
    minHeight: 120,
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  cardSelected: {
    borderColor: "#ff6d33",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#131313",
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  checkmark: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ff6d33",
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtn: {
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingVertical: 20,
    paddingHorizontal: 48,
    alignItems: "center",
    width: "100%",
    shadowColor: "#ff6d33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  continueBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#5f1b00",
  },
  skipLink: { paddingVertical: 8 },
  skipText: { fontSize: 14, color: "#594139", fontWeight: "600" },
});
