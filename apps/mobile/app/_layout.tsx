import "@/lib/webFontSmoothing"
import { useEffect, useState } from "react"
import { ActivityIndicator, AppState, InteractionManager, Platform, StyleSheet, View } from "react-native"
import { Stack } from "expo-router"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
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
import { AppStatusBar, FrameSafeArea } from "@/components/common/EdgeToEdge"
import { MemberSessionSync } from "@/components/member/MemberSessionSync"
import { ChordNoticeSync } from "@/components/song-chords/ChordNoticeSync"
import { LegacyRedirectHost } from "@/components/nav-v2/LegacyRedirectHost"
import { MiniPlayerHost } from "@/components/nav-v2/MiniPlayerHost"
import { NotificationsHost } from "@/components/notifications/NotificationsHost"
import { PlayReporterHost } from "@/components/authors/PlayReporterHost"
import { ListeningHistoryHost } from "@/components/listening/ListeningHistoryHost"
import { SaveHost } from "@/components/save/SaveHost"
import { PlaybackLifecycle } from "@/components/player/PlaybackLifecycle"
import { colors } from "@/constants/colors"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { applyLanguagePreference, useLanguageStore } from "@/stores/languageStore"
import { useAuthStore } from "@/stores/authStore"
import { usePlaylistStore } from "@/stores/playlistStore"

SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function RootLayout() {
  const [authHydrated, setAuthHydrated] = useState(() => useAuthStore.persist.hasHydrated())
  // The saved Light / Dark choice is read before the first frame so redesign screens never flash the wrong theme.
  const [appearanceHydrated, setAppearanceHydrated] = useState(() => useAppearanceStore.persist.hasHydrated())
  // Same for the interface language: read before the first frame so the app never flashes English first.
  const [languageHydrated, setLanguageHydrated] = useState(() => useLanguageStore.persist.hasHydrated())
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
  const shellReady = fontsReady && authHydrated && (appearanceHydrated || fontWaitExpired) && (languageHydrated || fontWaitExpired)

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setAuthHydrated(true)
    return useAuthStore.persist.onFinishHydration(() => setAuthHydrated(true))
  }, [])

  useEffect(() => {
    if (useAppearanceStore.persist.hasHydrated()) setAppearanceHydrated(true)
    return useAppearanceStore.persist.onFinishHydration(() => setAppearanceHydrated(true))
  }, [])

  useEffect(() => {
    if (useLanguageStore.persist.hasHydrated()) setLanguageHydrated(true)
    return useLanguageStore.persist.onFinishHydration(() => setLanguageHydrated(true))
  }, [])

  // Under "Automatic" the app follows the device: re-read it when the app comes back to the front.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") applyLanguagePreference(useLanguageStore.getState().language)
    })
    return () => sub.remove()
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
        <FrameSafeArea>
          <PlaybackLifecycle />
          <MemberSessionSync />
          <ChordNoticeSync />
          <LegacyRedirectHost />
          {/* Edge to edge: the app draws under the status bar; its content colour follows Light / Dark. */}
          <AppStatusBar />
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
            {/* The redesigned shell: the four tabs live in app/v2 (lib/navV2.ts). Old v1 addresses are mapped by lib/legacyRoutes.ts. */}
            <Stack.Screen name="v2" options={{ animation: "none" }} />
            <Stack.Screen name="festivals/index" options={{ presentation: "card" }} />
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
              name="language"
              options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }}
            />
            <Stack.Screen
              name="review-style"
              options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }}
            />
            <Stack.Screen name="parity/index" options={{ presentation: "card" }} />
            {/* Kiirtans: audio files uploaded by their authors, played in the one player. */}
            <Stack.Screen name="add-kirtan" options={{ presentation: "modal" }} />
            {/* Playlists from an event: the upload wizard, the playlist's page and the person's own list (docs/kiirtan-sets.md). */}
            <Stack.Screen name="upload-set" options={{ presentation: "modal" }} />
            <Stack.Screen name="recording-set/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="my-sets" options={{ presentation: "card" }} />
            {/* What members add to one recording: chord charts, video links, comments (docs/recording-extras.md). */}
            <Stack.Screen name="recording/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="recording-chords" options={{ presentation: "modal" }} />
            {/* Author pages: the directory, a public page, becoming an author, the author's own page and its edit form. */}
            <Stack.Screen name="authors" options={{ presentation: "card" }} />
            <Stack.Screen name="author/[slug]" options={{ presentation: "card" }} />
            <Stack.Screen name="become-author" options={{ presentation: "card" }} />
            <Stack.Screen name="my-author" options={{ presentation: "card" }} />
            <Stack.Screen name="author-edit" options={{ presentation: "card" }} />
            <Stack.Screen name="author-claims" options={{ presentation: "card" }} />
            <Stack.Screen name="author-find" options={{ presentation: "card" }} />
            {/* Upload: the hub of the tab bar's Upload button, offering chords for a song, and the team's review of them. */}
            <Stack.Screen name="upload" options={{ presentation: "modal" }} />
            <Stack.Screen name="upload-chords" options={{ presentation: "modal" }} />
            <Stack.Screen name="chords-review" options={{ presentation: "card" }} />
            <Stack.Screen name="kirtan-mix" options={{ presentation: "card" }} />
            <Stack.Screen name="kirtan-artist" options={{ presentation: "card" }} />
            <Stack.Screen name="content-rules" options={{ presentation: "card" }} />
            <Stack.Screen name="kiirtan-live" options={{ presentation: "card" }} />
            <Stack.Screen name="kiirtan" options={{ presentation: "card" }} />
            {/* All collections: search and kinds, opened from the Songs tab. */}
            <Stack.Screen name="collections-v2" options={{ presentation: "card" }} />
            {/* Your library: the person's own songs, Kiirtans, playlists, downloads and uploads; opened from the profile sheet. */}
            <Stack.Screen name="library-v2" options={{ presentation: "card" }} />
            {/* My listening history (on this phone only) and the full list behind a Search menu shelf. */}
            <Stack.Screen name="listening-history" options={{ presentation: "card" }} />
            {/* Top Played: the tracks people played most (counted by the server); opened from Today and from the Radio. */}
            <Stack.Screen name="top-played" options={{ presentation: "card" }} />
            <Stack.Screen name="browse-shelf" options={{ presentation: "card" }} />
            {/* The full player: opened from the mini-player pill or a Play action, closed by dragging down. */}
            <Stack.Screen name="player-v2" options={{ presentation: "transparentModal", animation: "slide_from_bottom", contentStyle: { backgroundColor: "transparent" } }} />
          </Stack>
          {/* The one mini-player, above every screen (tabs and pushed). */}
          <MiniPlayerHost />
          {/* The one "Save to" sheet (circle-plus buttons everywhere open it). */}
          <SaveHost />
          {/* Counts plays of recordings for their authors' statistics (watches the player, draws nothing). */}
          <PlayReporterHost />
          {/* The local listening history: adds a counted play to the log on this phone (draws nothing, sends nothing). */}
          <ListeningHistoryHost />
          {/* Reminders and the inbox: schedules local notifications, fills the bell. Draws nothing. */}
          <NotificationsHost />
        </FrameSafeArea>
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
