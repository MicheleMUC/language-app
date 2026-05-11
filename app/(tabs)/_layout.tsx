import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="vocabulary" />
      <Tabs.Screen name="scenarios" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
