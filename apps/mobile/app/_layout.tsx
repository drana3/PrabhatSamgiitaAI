import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="songs/[number]" options={{ presentation: "card" }} />
        <Stack.Screen name="stories/[slug]" options={{ presentation: "card" }} />
      </Stack>
    </>
  )
}
