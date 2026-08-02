import { Tabs } from "expo-router"
import { Platform } from "react-native"

import { colors } from "@/lib/client"

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold500,
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: colors.navy950,
          borderTopColor: "rgba(255,255,255,0.08)",
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: () => null }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: () => null }} />
      <Tabs.Screen name="stories" options={{ title: "Stories", tabBarIcon: () => null }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: () => null }} />
    </Tabs>
  )
}
