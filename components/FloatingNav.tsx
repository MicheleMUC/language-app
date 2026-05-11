import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const ITEMS = [
  { key: "home", icon: "🏠", route: "/" as const },
  { key: "history", icon: "📚", route: "/(tabs)/history" as const },
  { key: "vocabulary", icon: "📖", route: "/(tabs)/vocabulary" as const },
  { key: "scenarios", icon: "🗺️", route: "/(tabs)/scenarios" as const },
];

interface Props {
  active: "home" | "history" | "vocabulary" | "scenarios";
}

export function FloatingNav({ active }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 20 }]}>
      <View style={styles.pill}>
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => router.navigate(item.route)}
              style={[styles.item, isActive && styles.activeItem]}
              activeOpacity={0.75}
            >
              <Text style={styles.icon}>{item.icon}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  pill: {
    backgroundColor: "rgba(32,31,31,0.96)",
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(89,65,57,0.5)",
  },
  item: {
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activeItem: { backgroundColor: "#ff6d33" },
  icon: { fontSize: 20 },
});
