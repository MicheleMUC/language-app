import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import type { TurnFeedback } from "@/types";

interface Props {
  feedback: TurnFeedback | null;
  onDismiss: () => void;
}

export function TurnFeedbackCard({ feedback, onDismiss }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  // Keep last non-null feedback so we can render it during fade-out
  const lastFeedbackRef = useRef<TurnFeedback | null>(null);
  const [rendering, setRendering] = useState(false);
  // Stable ref to onDismiss so the effect never depends on the inline prop
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (feedback) {
      lastFeedbackRef.current = feedback;
      setRendering(true);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => onDismissRef.current(), 8000);
      return () => clearTimeout(timer);
    } else {
      // Fade out, then stop rendering
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 8, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setRendering(false);
      });
    }
  // Only re-run when feedback identity changes, not on every onDismiss reference change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  if (!rendering || !lastFeedbackRef.current) return null;

  const fb = lastFeedbackRef.current;
  const hasCorrection = !fb.ok && fb.correction;
  const hasPraiseOnly = fb.ok && fb.praise;

  if (!hasCorrection && !hasPraiseOnly) return null;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      {hasCorrection ? (
        <>
          <View style={styles.correctionRow}>
            <Text style={styles.original}>{fb.correction!.original}</Text>
            <Text style={styles.arrow}> → </Text>
            <Text style={styles.corrected}>{fb.correction!.corrected}</Text>
          </View>
          <Text style={styles.explanation}>{fb.correction!.explanation}</Text>
        </>
      ) : (
        <View style={styles.praiseRow}>
          <Text style={styles.praiseCheck}>✓</Text>
          <Text style={styles.praiseText}>{fb.praise}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#201f1f",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#353534",
    alignSelf: "flex-start",
    maxWidth: "90%",
  },
  correctionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 3,
  },
  original: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ff9966",
    textDecorationLine: "line-through",
    textDecorationColor: "#ff6d33",
  },
  arrow: { fontSize: 13, color: "#594139" },
  corrected: { fontSize: 13, fontWeight: "700", color: "#a8e4d4" },
  explanation: { fontSize: 12, color: "#a88a80", lineHeight: 17 },
  praiseRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  praiseCheck: { fontSize: 13, color: "#a8e4d4", fontWeight: "700" },
  praiseText: { fontSize: 13, color: "#a8e4d4", fontWeight: "500" },
});
