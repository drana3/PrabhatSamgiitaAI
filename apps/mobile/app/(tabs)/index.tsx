import { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  InteractionManager,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import {
  FEELING_ENABLE_IN_PROFILE_BODY,
  FEELING_ENABLE_IN_PROFILE_TITLE,
  HOME_SEARCH_EXAMPLES,
  queryGuidanceFor,
  queryIsUseful,
  SEARCH_PLACEHOLDER,
  type TodayRecommendations,
} from "@prabhat/core"

import { HomeHeroSearch } from "@/components/home/HomeHeroSearch"
import { HomeSearchExamples } from "@/components/home/HomeSearchExamples"
import { ScreenContainer, SectionHeader } from "@/components/common/ScreenContainer"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { CollectionsPreview } from "@/components/home/CollectionsPreview"
import { ContinueListeningRow } from "@/components/home/ContinueListeningRow"
import { FeedbackEntryCard, QuizBanner } from "@/components/home/EngagementCards"
import { GreetingHeader } from "@/components/home/GreetingHeader"
import { SiteAnnouncementsBanner } from "@/components/home/SiteAnnouncementsBanner"
import { QuizWinnersRow } from "@/components/home/QuizWinnersRow"
import {
  AboutComposerCard,
  CommunityVoicesRow,
  DailyReflectionCard,
} from "@/components/home/HomeExtras"
import { QuickActionGrid } from "@/components/home/QuickActionGrid"
import { StoriesPreview } from "@/components/home/StoriesPreview"
import { TodayContextCard } from "@/components/home/TodayContextCard"
import { TodaySongCard } from "@/components/home/TodaySongCard"
import { UpcomingFestivalsRow } from "@/components/home/UpcomingFestivalsRow"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { collectionSearchPrompt } from "@/data/collections"
import type { MockSong } from "@/data/mock"
import { loadCatalog } from "@/lib/catalog"
import { homeSearchSuggestions } from "@/lib/homeSearchSuggestions"
import { warmLyricSearchIndex } from "@/lib/lyricSearch"
import { prefetchScenicArt } from "@/lib/scenicPrefetch"
import { songSummaryToMockSong } from "@/lib/songMap"
import { readTodayCache, refreshTodayRecommendations } from "@/lib/todayCache"
import { todayItemToMockSong } from "@/lib/today"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

function recentPlayToMockSong(play: {
  id: string
  number: number
  title: string
  thumbnailUrl: string
  themes: string[]
}): MockSong {
  return {
    id: play.id,
    number: play.number,
    title: play.title,
    shortDescription: play.title,
    imageUrl: play.thumbnailUrl,
    thumbnailUrl: play.thumbnailUrl,
    themes: play.themes.length ? play.themes : ["Prabhat Samgiita"],
    meaning: "",
    lyrics: "",
    translation: "",
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos: [],
  }
}

export default function HomeScreen() {
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const feelingSearchEnabled = usePreferencesStore((s) => s.feelingSearchEnabled)
  const searchAuth = {
    signedIn: mode === "signed_in",
    feelingSearchEnabled: mode === "signed_in" && feelingSearchEnabled,
  }
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const [today, setToday] = useState<TodayRecommendations | null>(null)
  const [loadingToday, setLoadingToday] = useState(true)
  const [suggestedSongs, setSuggestedSongs] = useState<MockSong[]>([])
  const [homeError, setHomeError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showRest, setShowRest] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const searchSlotOffsetY = useRef(0)

  const bringSearchAboveKeyboard = () => {
    const y = Math.max(0, searchSlotOffsetY.current - spacing.sm)
    scrollRef.current?.scrollTo({ y, animated: true })
  }

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setShowRest(true)
      warmLyricSearchIndex()
    })
    return () => task.cancel()
  }, [])

  useEffect(() => {
    let active = true
    prefetchScenicArt()
    setLoadingToday(true)
    setHomeError(null)

    const applyToday = (value: TodayRecommendations) => {
      setToday(value)
      const fromToday = (value.recommendations ?? [])
        .slice(0, 8)
        .map((item, index) => todayItemToMockSong(item, index))
      if (fromToday.length) setSuggestedSongs(fromToday)
    }

    void (async () => {
      const cached = await readTodayCache()
      if (active && cached) {
        applyToday(cached)
        setLoadingToday(false)
      }

      const result = await refreshTodayRecommendations()
      if (!active) return

      if (result.today) {
        applyToday(result.today)
        // Only surface hard failures — cache fallbacks stay silent.
        if (result.error && !result.fromCache) setHomeError(result.error)
        setLoadingToday(false)
        return
      }

      if (result.error && !result.fromCache) setHomeError(result.error)
      const catalog = await loadCatalog()
      if (!active) return
      if (catalog.error && !catalog.songs.length) setHomeError(catalog.error)
      setSuggestedSongs(catalog.songs.slice(0, 8).map((row, index) => songSummaryToMockSong(row, index)))
      setLoadingToday(false)
    })()

    return () => {
      active = false
    }
  }, [])

  const recentSongs = useMemo(
    () => recentPlays.map(recentPlayToMockSong),
    [recentPlays],
  )
  const continueSongs = recentSongs.length ? recentSongs : suggestedSongs
  const continueTitle = recentSongs.length ? "Continue listening" : "Suggested for you"
  const searchSuggestions = useMemo(
    () => homeSearchSuggestions(searchQuery, 5, searchAuth),
    [searchQuery, searchAuth.signedIn, searchAuth.feelingSearchEnabled],
  )
  const searching = searchQuery.trim().length > 0

  // Keep the search field + suggestions visible above the iOS keyboard.
  useEffect(() => {
    if (!searching) return
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height)
      requestAnimationFrame(bringSearchAboveKeyboard)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    const handle = requestAnimationFrame(bringSearchAboveKeyboard)
    const retry = setTimeout(bringSearchAboveKeyboard, 120)
    return () => {
      showSub.remove()
      hideSub.remove()
      cancelAnimationFrame(handle)
      clearTimeout(retry)
    }
  }, [searching, searchSuggestions.length])

  useEffect(() => {
    if (searching) return
    setKeyboardHeight(0)
  }, [searching])

  const featuredSong = useMemo(() => {
    const first = today?.recommendations?.[0]
    return first ? todayItemToMockSong(first, 0) : suggestedSongs[0] ?? recentSongs[0] ?? null
  }, [today, suggestedSongs, recentSongs])

  useEffect(() => {
    if (!continueSongs.length && !featuredSong) return
    const warm = InteractionManager.runAfterInteractions(() => {
      if (featuredSong) usePlayerStore.getState().warmAudio(featuredSong)
      for (const song of continueSongs.slice(0, 3)) {
        usePlayerStore.getState().warmAudio(song)
      }
    })
    return () => warm.cancel()
  }, [featuredSong, continueSongs])

  const openSongNumber = (number: number) => {
    usePlayerStore.getState().warmAudio({
      id: `ps-${number}`,
      number,
      title: "",
      shortDescription: "",
      imageUrl: "",
      thumbnailUrl: "",
      themes: [],
      meaning: "",
      lyrics: "",
      translation: "",
      durationSeconds: 300,
      performer: "",
      videos: [],
      audioUrl: null,
      mediaHydrated: false,
    })
    router.push(href(`/song/ps-${number}`))
  }

  const openSong = (song: MockSong) => {
    usePlayerStore.getState().warmAudio(song)
    router.push(href(`/song/${song.id}`))
  }

  const submitHomeSearch = () => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      router.push(href("/search?focus=1"))
      return
    }
    if (!queryIsUseful(trimmed, 200)) {
      Alert.alert("Try a clearer search", queryGuidanceFor(searchQuery))
      return
    }
    router.push(href(`/search?focus=1&q=${encodeURIComponent(trimmed)}`))
  }

  const onSearchExample = (example: (typeof HOME_SEARCH_EXAMPLES)[number]) => {
    setSearchQuery(example.query)
    if (example.mode === "feeling") {
      if (mode !== "signed_in") {
        router.push(href("/signin"))
        return
      }
      if (!feelingSearchEnabled) {
        Alert.alert(FEELING_ENABLE_IN_PROFILE_TITLE, FEELING_ENABLE_IN_PROFILE_BODY, [
          { text: "Not now", style: "cancel" },
          { text: "Open Profile", onPress: () => router.push(href("/(tabs)/profile")) },
        ])
        return
      }
      router.push(href(`/search?focus=1&q=${encodeURIComponent(example.query)}`))
      return
    }
    if (/^\d+$/.test(example.query.trim())) {
      openSongNumber(Number(example.query.trim()))
      return
    }
    router.push(href(`/search?focus=1&q=${encodeURIComponent(example.query)}`))
  }

  return (
    <ScreenContainer padded={false} showGuru={false}>
      <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                (hasSong ? 160 : 110) + (searching && keyboardHeight ? keyboardHeight * 0.55 : 0),
            },
          ]}
        >
          <GreetingHeader
            onNotifyPress={() =>
              mode === "guest"
                ? router.push(href("/signin"))
                : Alert.alert(
                    "Daily reminders",
                    "Push notification preferences are not available in this build yet. Open Profile for account and language settings.",
                    [
                      { text: "Not now", style: "cancel" },
                      { text: "Open Profile", onPress: () => router.push(href("/(tabs)/profile")) },
                    ],
                  )
            }
          />
          <View
            style={styles.searchSlot}
            onLayout={(event) => {
              searchSlotOffsetY.current = event.nativeEvent.layout.y
            }}
          >
            <HomeHeroSearch
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmit={submitHomeSearch}
              onMicPress={() => router.push(href("/search?listen=1"))}
              placeholder={SEARCH_PLACEHOLDER}
            />
            {!searching ? (
              <HomeSearchExamples
                signedIn={mode === "signed_in"}
                feelingOn={mode === "signed_in" && feelingSearchEnabled}
                onSelect={onSearchExample}
              />
            ) : null}
            {searchSuggestions.length ? (
              <View style={styles.suggestionCard}>
                <Text style={styles.suggestionLabel}>Songs</Text>
                {searchSuggestions.map((song) => (
                  <CompactSongRow
                    key={song.id}
                    song={song}
                    lyricLine={song.shortDescription}
                    onPress={() => openSong(song)}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <SiteAnnouncementsBanner />

        {homeError ? <Text style={styles.homeError}>{homeError}</Text> : null}

        <View style={styles.block}>
          <TodayContextCard
            today={today}
            loading={loadingToday}
            onOpenSong={openSongNumber}
          />
        </View>

        <View style={styles.block}>
          <SectionHeader title="Experience today" />
          {featuredSong ? (
            <TodaySongCard
              song={featuredSong}
              onPress={() => openSong(featuredSong)}
              onWatch={() => router.push(href(`/song/${featuredSong.id}?tab=watch`))}
              onAskAi={() => router.push(href(`/(tabs)/ai?song=${featuredSong.number}`))}
            />
          ) : (
            <Text style={styles.sectionLead}>
              {loadingToday ? "Loading today’s song…" : "Today’s recommendations are warming up."}
            </Text>
          )}
        </View>

        <View style={styles.block}>
          <QuickActionGrid
            onAction={(key) => {
              if (key === "explore") router.push(href("/(tabs)/songs"))
              else router.push(href("/collections"))
            }}
          />
        </View>

        <View style={styles.block}>
          <SectionHeader
            title={continueTitle}
            actionLabel="See all"
            onActionPress={() => router.push(href("/(tabs)/songs"))}
          />
          {continueSongs.length ? (
            <ContinueListeningRow songs={continueSongs} onOpen={openSong} />
          ) : (
            <Text style={styles.sectionLead}>
              {loadingToday ? "Loading catalog…" : "No songs available yet."}
            </Text>
          )}
        </View>

        {showRest ? (
          <>
        <View style={styles.block}>
          <Text style={styles.groupLabel}>Discover</Text>
          <UpcomingFestivalsRow
            onOpenFestival={(id) => router.push(href(`/festival/${id}`))}
            onSeeAll={() => router.push(href("/festivals"))}
          />
        </View>

        <View style={styles.block}>
          <CollectionsPreview
            onOpenCollection={(item) =>
              router.push(href(`/search?focus=1&q=${encodeURIComponent(collectionSearchPrompt(item.label))}`))
            }
            onSeeAll={() => router.push(href("/collections"))}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.groupLabel}>Inspiration</Text>
          <DailyReflectionCard />
        </View>

        <View style={styles.block}>
          <StoriesPreview
            onOpenStory={(story) => router.push(href(`/stories/${story.slug}`))}
            onSeeAll={() => router.push(href("/stories"))}
          />
        </View>

        <View style={styles.block}>
          <AboutComposerCard onPress={() => router.push(href("/about"))} />
        </View>

        <View style={styles.block}>
          <Text style={styles.groupLabel}>Belong</Text>
          <CommunityVoicesRow />
        </View>

        <View style={styles.block}>
          <QuizWinnersRow />
        </View>

        <View style={styles.block}>
          <QuizBanner
            isGuest={mode === "guest"}
            onPress={() => router.push(href(mode === "guest" ? "/signin" : "/quiz"))}
            onScanPress={() => router.push(href(mode === "guest" ? "/signin" : "/quiz/scan"))}
          />
        </View>

        <View style={styles.block}>
          <FeedbackEntryCard
            onPress={() => router.push(href(mode === "guest" ? "/signin" : "/feedback"))}
          />
        </View>
          </>
        ) : null}
        </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  searchSlot: {
    marginTop: -spacing.lg,
    marginBottom: spacing.md,
    zIndex: 100,
    elevation: 100,
  },
  suggestionCard: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  block: {
    marginTop: spacing.xl,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: spacing.md,
  },
  sectionLead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  homeError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.md,
  },
})
