import { View, Text, StyleSheet } from "react-native";

const CATEGORY_LABELS: Record<string, string> = {
  passato_prossimo: "Passato Prossimo",
  subjunctive: "Congiuntivo",
  gender_agreement: "Accordo di Genere",
  pronoun_order: "Ordine dei Pronomi",
  future_tense: "Futuro",
  conditional: "Condizionale",
};

function barColor(score: number): string {
  if (score < 0.4) return "#d94f3d";
  if (score < 0.7) return "#dcc841";
  return "#a8e4d4";
}

interface Props {
  category: string;
  score: number; // 0-1
}

export function GrammarProgressBar({ category, score }: Props) {
  const label = CATEGORY_LABELS[category] ?? category;
  const pct = Math.round(score * 100);
  const color = barColor(score);

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.pct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 14, fontWeight: "600", color: "#e5e2e1" },
  pct: { fontSize: 13, fontWeight: "700" },
  track: {
    height: 8,
    backgroundColor: "#2c2c2c",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
