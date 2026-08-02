import { Stack } from "expo-router"
import { Platform } from "react-native"
import { StatusBar } from "expo-status-bar"

import { colors } from "@/lib/client"

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ivory50 },
          animation: Platform.OS === "android" ? "fade_from_bottom" : "default",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="songs/[number]" options={{ presentation: "card" }} />
        <Stack.Screen name="stories/[slug]" options={{ presentation: "card" }} />
      </Stack>
    </>
  )
}
