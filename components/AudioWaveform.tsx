import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

interface Props {
  active: boolean;
  color?: string;
}

const BAR_COUNT = 5;

export function AudioWaveform({ active, color = "#2563EB" }: Props) {
  const anims = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) => Animated.spring(a, { toValue: 0.3, useNativeDriver: true }).start());
      return;
    }

    const animations = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.spring(a, { toValue: 1, useNativeDriver: true }),
          Animated.spring(a, { toValue: 0.3, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [active, anims]);

  return (
    <View style={styles.container}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            { backgroundColor: color, transform: [{ scaleY: anim }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 4, height: 40 },
  bar: { width: 4, height: 36, borderRadius: 2 },
});
