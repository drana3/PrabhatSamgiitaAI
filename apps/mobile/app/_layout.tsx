import { useEffect, useState } from "react"
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native"
import { Stack } from "expo-router"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInter,
} from "@expo-google-fonts/inter"
import { Lora_700Bold, useFonts as useLora } from "@expo-google-fonts/lora"
import * as SplashScreen from "expo-splash-screen"

import { prefetchScenicArt } from "@/lib/scenicPrefetch"
import { warmCategorySongsCache } from "@/lib/categorySongs"
import { MemberSessionSync } from "@/components/member/MemberSessionSync"
import { PlaybackLifecycle } from "@/components/player/PlaybackLifecycle"
import { colors } from "@/constants/colors"

SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function RootLayout() {
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })
  const [loraLoaded] = useLora({ Lora_700Bold })
  const [fontWaitExpired, setFontWaitExpired] = useState(false)
  const fontsReady = (interLoaded && loraLoaded) || fontWaitExpired

  useEffect(() => {
    const timer = setTimeout(() => setFontWaitExpired(true), 800)
    // Thumbs warm immediately; heroes continue after interactions inside prefetch.
    prefetchScenicArt()
    // Precompute category browse lists from catalog cache (no live search).
    void warmCategorySongsCache()
    return () => {
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => undefined)
    }
  }, [fontsReady])

  if (!fontsReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PlaybackLifecycle />
        <MemberSessionSync />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: Platform.OS === "ios" ? "slide_from_right" : "fade_from_bottom",
            animationDuration: 220,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="auth" options={{ animation: "none" }} />
          <Stack.Screen name="auth/google" options={{ animation: "none" }} />
          <Stack.Screen name="complete-profile" />
          <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
          <Stack.Screen name="song/[songId]" options={{ presentation: "card" }} />
          <Stack.Screen
            name="player/index"
            options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen name="search/index" options={{ presentation: "modal", animation: "fade" }} />
          <Stack.Screen name="collections/index" options={{ presentation: "card" }} />
          <Stack.Screen name="festivals/index" options={{ presentation: "card" }} />
          <Stack.Screen name="festival/[festivalId]" options={{ presentation: "card" }} />
          <Stack.Screen name="quiz/index" options={{ presentation: "card" }} />
          <Stack.Screen name="quiz/scan" options={{ presentation: "card" }} />
          <Stack.Screen name="quiz/event/[slug]" options={{ presentation: "card" }} />
          <Stack.Screen name="feedback/index" options={{ presentation: "modal" }} />
          <Stack.Screen name="admin/index" options={{ presentation: "card" }} />
          <Stack.Screen name="stories/index" options={{ presentation: "card" }} />
          <Stack.Screen name="stories/[slug]" options={{ presentation: "card" }} />
          <Stack.Screen name="signin/index" options={{ presentation: "modal" }} />
          <Stack.Screen name="about/index" options={{ presentation: "card" }} />
          <Stack.Screen name="parity/index" options={{ presentation: "card" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
})
