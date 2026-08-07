import { useEffect, useMemo, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import type { TodayRecommendations } from "@prabhat/core"

import { SearchBar } from "@/components/common/SearchBar"
import { ScreenContainer, SectionHeader } from "@/components/common/ScreenContainer"
import { CollectionsPreview } from "@/components/home/CollectionsPreview"
import { ContinueListeningRow } from "@/components/home/ContinueListeningRow"
import { FeedbackEntryCard, QuizBanner } from "@/components/home/EngagementCards"
import { GreetingHeader } from "@/components/home/GreetingHeader"
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
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { collectionSearchPrompt } from "@/data/collections"
import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { loadCatalog } from "@/lib/catalog"
import { songSummaryToMockSong } from "@/lib/songMap"
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
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const [today, setToday] = useState<TodayRecommendations | null>(null)
  const [loadingToday, setLoadingToday] = useState(true)
  const [suggestedSongs, setSuggestedSongs] = useState<MockSong[]>([])
  const [homeError, setHomeError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoadingToday(true)
    setHomeError(null)
    void api
      .fetchTodayRecommendations()
      .then((value) => {
        if (!active) return
        setToday(value)
        const fromToday = (value?.recommendations ?? [])
          .slice(0, 8)
          .map((item, index) => todayItemToMockSong(item, index))
        if (fromToday.length) {
          setSuggestedSongs(fromToday)
          return
        }
        return loadCatalog().then((catalog) => {
          if (!active) return
          if (catalog.error && !catalog.songs.length) setHomeError(catalog.error)
          setSuggestedSongs(
            catalog.songs.slice(0, 8).map((row, index) => songSummaryToMockSong(row, index)),
          )
        })
      })
      .catch(() => {
        if (!active) return
        setHomeError("Could not load today’s recommendations. Check your connection.")
      })
      .finally(() => {
        if (active) setLoadingToday(false)
      })
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

  const featuredSong = useMemo(() => {
    const first = today?.recommendations?.[0]
    return first ? todayItemToMockSong(first, 0) : suggestedSongs[0] ?? recentSongs[0] ?? null
  }, [today, suggestedSongs, recentSongs])

  const openSongNumber = (number: number) => {
    router.push(href(`/song/ps-${number}`))
  }

  const openSong = (song: MockSong) => {
    router.push(href(`/song/${song.id}`))
  }

  return (
    <ScreenContainer padded={false} showGuru={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: hasSong ? 160 : 110 }]}
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
        <SearchBar
          placeholder="Ask about any Prabhat Samgiita..."
          showMic
          onPress={() => router.push(href("/search"))}
          onMicPress={() => router.push(href("/search?voice=1"))}
        />

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
              router.push(href(`/search?q=${encodeURIComponent(collectionSearchPrompt(item.label))}`))
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
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
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
