import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { WeaknessMap } from "@/types";

const CATEGORY_LABELS: Record<string, string> = {
  passato_prossimo: "Passato Prossimo",
  subjunctive: "Congiuntivo",
  gender_agreement: "Accordo di Genere",
  pronoun_order: "Ordine dei Pronomi",
  future_tense: "Futuro",
  conditional: "Condizionale",
};

const CATEGORY_TO_SCENARIO: Record<string, { label: string; intent: string; emoji: string }> = {
  subjunctive: {
    label: "Al ristorante\nformale",
    intent: "A formal dinner at an Italian restaurant where you must politely express wishes and preferences",
    emoji: "🍷",
  },
  gender_agreement: {
    label: "Shopping\nal mercato",
    intent: "Shopping for clothes and accessories at an Italian street market",
    emoji: "🛍️",
  },
  pronoun_order: {
    label: "Con la\nfamiglia",
    intent: "Chatting with an Italian host family and giving instructions or directions",
    emoji: "🏠",
  },
  future_tense: {
    label: "Pianifica\nil viaggio",
    intent: "Planning an upcoming trip to Italy with a travel agent",
    emoji: "✈️",
  },
  conditional: {
    label: "Cena\nelegante",
    intent: "Politely ordering food and wine at a fine Italian restaurant",
    emoji: "🥂",
  },
  passato_prossimo: {
    label: "Weekend\nraccontato",
    intent: "Telling an Italian friend about what you did last weekend",
    emoji: "📖",
  },
};

const FALLBACK = {
  label: "Pratica\nlibera",
  intent: "A casual everyday Italian conversation",
  emoji: "💬",
  category: null as string | null,
};

function weakestCategory(weaknessMap: WeaknessMap): string | null {
  const entries = Object.entries(weaknessMap);
  if (entries.length === 0) return null;
  return entries.reduce((worst, cur) => (cur[1] < worst[1] ? cur : worst))[0];
}

interface Props {
  weaknessMap: WeaknessMap;
  loading: boolean;
  onPress: (intent: string, grammarFocus: string | undefined) => void;
}

export function SuggestedScenarioCard({ weaknessMap, loading, onPress }: Props) {
  const cat = weakestCategory(weaknessMap);
  const scenario = cat ? CATEGORY_TO_SCENARIO[cat] : null;
  const catLabel = cat ? (CATEGORY_LABELS[cat] ?? cat) : null;

  const intent = scenario?.intent ?? FALLBACK.intent;
  const emoji = scenario?.emoji ?? FALLBACK.emoji;
  const label = scenario?.label ?? FALLBACK.label;

  return (
    <TouchableOpacity
      onPress={() => onPress(intent, cat ?? undefined)}
      disabled={loading}
      style={[styles.card, loading && { opacity: 0.6 }]}
      activeOpacity={0.85}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>PER TE</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <Text style={{ fontSize: 18 }}>{emoji}</Text>
          </View>
          <Text style={styles.label}>{label}</Text>
          {catLabel ? (
            <Text style={styles.sub}>Pratica: {catLabel}</Text>
          ) : (
            <Text style={styles.sub}>Scenario personalizzato</Text>
          )}
        </View>
        <View style={styles.right}>
          {loading ? (
            <ActivityIndicator size="small" color="#ff6d33" />
          ) : (
            <Text style={styles.arrow}>→</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#1a1510",
    borderWidth: 1.5,
    borderColor: "#ff6d33",
    padding: 20,
    overflow: "hidden",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#ff6d33",
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#5f1b00", letterSpacing: 1.5 },
  content: { flexDirection: "row", alignItems: "center" },
  left: { flex: 1, gap: 6 },
  right: { paddingLeft: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,109,51,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 22, fontWeight: "700", color: "#e5e2e1", lineHeight: 28 },
  sub: { fontSize: 13, fontWeight: "600", color: "#ff6d33" },
  arrow: { fontSize: 22, color: "#ff6d33", fontWeight: "700" },
});
