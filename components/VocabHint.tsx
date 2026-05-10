import { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";
import type { VocabItem } from "@/types";

interface Props {
  item: VocabItem | null;
}

export function VocabHint({ item }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(3200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [item, opacity]);

  if (!item) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity }]}>
      <View style={styles.card}>
        <View style={styles.textWrap}>
          <Text style={styles.italian}>{item.italian}</Text>
          <Text style={styles.english}>{item.english}</Text>
        </View>
        {item.example && (
          <Text style={styles.example} numberOfLines={2}>{item.example}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", top: 16, left: 16, right: 16 },
  card: {
    backgroundColor: "#dcc841",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  textWrap: { flex: 1 },
  italian: { fontSize: 16, fontWeight: "700", color: "#373100" },
  english: { fontSize: 13, color: "rgba(55,49,0,0.8)", marginTop: 2 },
  example: { fontSize: 12, color: "rgba(55,49,0,0.7)", maxWidth: "45%", textAlign: "right" },
});
