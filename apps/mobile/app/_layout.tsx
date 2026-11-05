import "@/lib/webFontSmoothing"
import { useEffect, useState } from "react"
import { ActivityIndicator, InteractionManager, Platform, StyleSheet, View } from "react-native"
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
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Roboto_800ExtraBold,
  useFonts as useRoboto,
} from "@expo-google-fonts/roboto"
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
  useFonts as useDevanagari,
} from "@expo-google-fonts/noto-sans-devanagari"
import * as SplashScreen from "expo-splash-screen"

import { startPlaylistBackgroundSync } from "@/lib/playlistBackgroundSync"
import { prefetchScenicArt } from "@/lib/scenicPrefetch"
import { hydrateOfflineAudio } from "@/lib/offlineAudio"
import { warmCategorySongsCache } from "@/lib/categorySongs"
import { MemberSessionSync } from "@/components/member/MemberSessionSync"
import { MiniPlayerHost } from "@/components/nav-v2/MiniPlayerHost"
import { NotificationsHost } from "@/components/notifications/NotificationsHost"
import { SaveHost } from "@/components/save/SaveHost"
import { PlaybackLifecycle } from "@/components/player/PlaybackLifecycle"
import { colors } from "@/constants/colors"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { useAuthStore } from "@/stores/authStore"
import { usePlaylistStore } from "@/stores/playlistStore"

SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function RootLayout() {
  const [authHydrated, setAuthHydrated] = useState(() => useAuthStore.persist.hasHydrated())
  // The saved Light / Dark choice is read before the first frame so redesign screens never flash the wrong theme.
  const [appearanceHydrated, setAppearanceHydrated] = useState(() => useAppearanceStore.persist.hasHydrated())
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })
  const [loraLoaded] = useLora({ Lora_700Bold })
  // Redesign typeface (constants/tokens/amTypography.ts); current screens still use Inter.
  const [robotoLoaded] = useRoboto({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_600SemiBold,
    Roboto_700Bold,
    Roboto_800ExtraBold,
  })
  // Devanagari lyrics (Player karaoke, Song page). Not awaited: the text shows in a fallback first.
  useDevanagari({ NotoSansDevanagari_400Regular, NotoSansDevanagari_600SemiBold, NotoSansDevanagari_700Bold })
  const [fontWaitExpired, setFontWaitExpired] = useState(false)
  const fontsReady = (interLoaded && loraLoaded && robotoLoaded) || fontWaitExpired
  const shellReady = fontsReady && authHydrated && (appearanceHydrated || fontWaitExpired)

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setAuthHydrated(true)
    return useAuthStore.persist.onFinishHydration(() => setAuthHydrated(true))
  }, [])

  useEffect(() => {
    if (useAppearanceStore.persist.hasHydrated()) setAppearanceHydrated(true)
    return useAppearanceStore.persist.onFinishHydration(() => setAppearanceHydrated(true))
  }, [])

  useEffect(() => {
    if (!authHydrated || useAuthStore.getState().mode !== "signed_in") return
    void usePlaylistStore.getState().hydrateFromCache()
  }, [authHydrated])

  // Load offline audio index as soon as auth scope is known — do not defer on
  // Android (InteractionManager raced play before files were ready offline).
  useEffect(() => {
    if (!authHydrated) return
    void hydrateOfflineAudio()
  }, [authHydrated])

  useEffect(() => {
    startPlaylistBackgroundSync()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setFontWaitExpired(true), 800)
    const warmCaches = () => {
      prefetchScenicArt()
      void warmCategorySongsCache()
    }
    if (Platform.OS === "android") {
      InteractionManager.runAfterInteractions(warmCaches)
    } else {
      warmCaches()
    }
    return () => {
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (shellReady) {
      SplashScreen.hideAsync().catch(() => undefined)
    }
  }, [shellReady])

  if (!shellReady) {
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
            animation: "slide_from_right",
            animationDuration: 220,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="auth" options={{ animation: "none" }} />
          <Stack.Screen name="auth/google" options={{ animation: "none" }} />
          <Stack.Screen name="complete-profile" />
          <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
          <Stack.Screen
            name="song/[songId]"
            options={{
              presentation: "card",
              // Slide + Reanimated + expo-av in the same frame crashes Android.
              animation: Platform.OS === "ios" ? "slide_from_right" : "none",
            }}
          />
          <Stack.Screen
            name="player/index"
            options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="search/index"
            options={{
              // Same fade as iOS. Android stays a card so dismiss+push cannot
              // crash native navigation; iOS can keep the modal presentation.
              presentation: Platform.OS === "ios" ? "modal" : "card",
              animation: "fade",
              animationDuration: 220,
            }}
          />
          <Stack.Screen name="collections/index" options={{ presentation: "card" }} />
          <Stack.Screen name="festivals/index" options={{ presentation: "card" }} />
          <Stack.Screen name="drive/index" options={{ presentation: "card" }} />
          <Stack.Screen name="playlist/[playlistId]" options={{ presentation: "card" }} />
          <Stack.Screen name="playlist/add" options={{ presentation: "card" }} />
          <Stack.Screen name="festival/[festivalId]" options={{ presentation: "card" }} />
          <Stack.Screen name="quiz/index" options={{ presentation: "card" }} />
          <Stack.Screen name="quiz/scan" options={{ presentation: "card" }} />
          <Stack.Screen name="quiz/event/[slug]" options={{ presentation: "card" }} />
          <Stack.Screen name="feedback/index" options={{ presentation: "card" }} />
          <Stack.Screen name="admin/index" options={{ presentation: "card" }} />
          <Stack.Screen name="admin/devanagari" options={{ presentation: "card" }} />
          <Stack.Screen name="admin/sargam/[number]" options={{ presentation: "card" }} />
          <Stack.Screen name="stories/index" options={{ presentation: "card" }} />
          <Stack.Screen name="stories/[slug]" options={{ presentation: "card" }} />
          <Stack.Screen name="signin/index" options={{ presentation: "modal" }} />
          <Stack.Screen name="about/index" options={{ presentation: "card" }} />
          {/* Redesign profile sheet: it animates itself, so the navigator adds no motion. */}
          <Stack.Screen
            name="profile-sheet"
            options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }}
          />
          {/* Sheets that replace the profile sheet; they animate themselves too. */}
          <Stack.Screen
            name="script-translations"
            options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }}
          />
          <Stack.Screen
            name="review-style"
            options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }}
          />
          <Stack.Screen name="parity/index" options={{ presentation: "card" }} />
          {/* Kiirtans: audio files uploaded by their authors, played in the one player. */}
          <Stack.Screen name="add-kirtan" options={{ presentation: "modal" }} />
          <Stack.Screen name="kirtan-mix" options={{ presentation: "card" }} />
          <Stack.Screen name="kirtan-artist" options={{ presentation: "card" }} />
          <Stack.Screen name="kiirtan-live" options={{ presentation: "card" }} />
          <Stack.Screen name="kiirtan" options={{ presentation: "card" }} />
          {/* All collections: search and kinds, opened from the Songs tab. */}
          <Stack.Screen name="collections-v2" options={{ presentation: "card" }} />
          {/* Your library: the person's own songs, Kiirtans, playlists, downloads and uploads; opened from the profile sheet. */}
          <Stack.Screen name="library-v2" options={{ presentation: "card" }} />
          {/* The full player: opened from the mini-player pill or a Play action, closed by dragging down. */}
          <Stack.Screen name="player-v2" options={{ presentation: "transparentModal", animation: "slide_from_bottom", contentStyle: { backgroundColor: "transparent" } }} />
        </Stack>
        {/* The one mini-player, above every screen (tabs and pushed). */}
        <MiniPlayerHost />
        {/* The one "Save to" sheet (circle-plus buttons everywhere open it). */}
        <SaveHost />
        {/* Reminders and the inbox: schedules local notifications, fills the bell. Draws nothing. */}
        <NotificationsHost />
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
