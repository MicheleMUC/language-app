import { useEffect, useRef } from "react";
import { Animated, View, Text } from "react-native";
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
    <Animated.View style={{ opacity }} className="absolute top-4 left-4 right-4">
      <View className="bg-accent/90 rounded-xl px-4 py-3 flex-row items-center justify-between">
        <View>
          <Text className="text-white font-bold text-base">{item.italian}</Text>
          <Text className="text-green-100 text-sm">{item.english}</Text>
        </View>
        {item.example && (
          <Text className="text-green-100 text-xs max-w-[50%] text-right">{item.example}</Text>
        )}
      </View>
    </Animated.View>
  );
}
