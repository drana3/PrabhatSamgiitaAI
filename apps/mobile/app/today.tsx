import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import type { TodayRecommendationItem, TodayRecommendations } from "@prabhat/core"

import { Reveal } from "@/components/today/motion"
import { TodayHero } from "@/components/today/TodayHero"
import {
  FindWayRows,
  RecentRows,
  ResumeCard,
  StoryCard,
  TodaySearchPill,
  TodayTopBar,
  TwoToneHeading,
} from "@/components/today/TodayBlocks"
import { amGap } from "@/constants/tokens/amSpacing"
import type { MockSong } from "@/data/mock"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { useAmTheme } from "@/hooks/useAmTheme"
import { loadCatalog } from "@/lib/catalog"
import { api } from "@/lib/client"
import { memberProfileName } from "@/lib/displayName"
import { songPlayback } from "@/lib/playback"
import { songSummaryToMockSong } from "@/lib/songMap"
import { todayItemToMockSong } from "@/lib/today"
import { readTodayCache, refreshTodayRecommendations } from "@/lib/todayCache"
import { buildTodayView, formatTodayEyebrow, storyOfTheWeek } from "@/lib/todayView"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/**
 * Today (spec SCR-10): the daily ritual in under 30 seconds.
 * Redesign screen, reachable at /today until the tab bar switches to it.
 */
export default function TodayScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const now = useMemo(() => new Date(), [])

  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const currentSong = usePlayerStore((s) => s.currentSong)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)

  const [recommended, setRecommended] = useState<MockSong[]>([])
  const [stories, setStories] = useState<StorySummary[]>([])

  useEffect(() => {
    let active = true
    const apply = (value: TodayRecommendations) => {
      const songs = (value.recommendations ?? []).slice(0, 8).map((item: TodayRecommendationItem, i: number) => todayItemToMockSong(item, i))
      if (active && songs.length) setRecommended(songs)
    }
    void (async () => {
      const cached = await readTodayCache()
      if (cached) apply(cached)
      const result = await refreshTodayRecommendations()
      if (result.today) {
        apply(result.today)
        return
      }
      const catalog = await loadCatalog()
      if (active && catalog.songs.length) {
        setRecommended(catalog.songs.slice(0, 8).map((row, i) => songSummaryToMockSong(row, i)))
      }
    })()
    void api.fetchStories({ limit: 12 }).then((rows) => {
      if (active) setStories(rows.map(mapApiStory))
    })
    return () => {
      active = false
    }
  }, [])

  const view = useMemo(() => buildTodayView({ recommended, recentPlays, now }), [recommended, recentPlays, now])
  const story = useMemo(() => storyOfTheWeek(stories, now), [stories, now])
  const initials =
    memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "·"

  const playing = (song: MockSong) => {
    const state = usePlayerStore.getState()
    return songPlayback(state, song).showPause
  }
  const isHeroPlaying = view.hero ? playing(view.hero) && currentSong?.number === view.hero.number : false
  const openSong = (song: MockSong) => router.push(href(`/song/${song.id}`))
  const resumeIsCurrent = view.resume && currentSong?.number === view.resume.song.number

  let block = 0
  const next = () => block++

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <Reveal index={next()}>
          <TodayTopBar theme={theme} initials={initials} onAvatar={() => router.push(href("/(tabs)/profile"))} />
        </Reveal>

        <Reveal index={next()}>
          <TodaySearchPill theme={theme} onPress={() => router.push(href("/search?focus=1"))} />
        </Reveal>

        {view.hero ? (
          <Reveal index={next()}>
            <TodayHero
              theme={theme}
              song={view.hero}
              eyebrow={formatTodayEyebrow(now)}
              isPlaying={isHeroPlaying}
              onListen={() => playOrToggle(view.hero!)}
              onReadLyrics={() => openSong(view.hero!)}
            />
          </Reveal>
        ) : null}

        {view.resume ? (
          <Reveal index={next()}>
            <TwoToneHeading
              theme={theme}
              first={view.resume.kind === "resume" ? "Pick up" : "Song"}
              second={view.resume.kind === "resume" ? "where you stopped" : "of the day"}
            />
            <ResumeCard
              theme={theme}
              song={view.resume.song}
              kind={view.resume.kind}
              positionSeconds={resumeIsCurrent ? position : 0}
              durationSeconds={resumeIsCurrent ? duration : 0}
              onPlay={() => playOrToggle(view.resume!.song)}
              onOpen={() => openSong(view.resume!.song)}
            />
          </Reveal>
        ) : null}

        <Reveal index={next()}>
          <TwoToneHeading theme={theme} first="Find a song" second="your way" />
          <FindWayRows theme={theme} onOpen={(to) => router.push(href(to))} />
        </Reveal>

        {story ? (
          <Reveal index={next()}>
            <StoryCard title={story.title} onPress={() => router.push(href(`/stories/${story.slug}`))} />
          </Reveal>
        ) : null}

        {view.recent.length ? (
          <Reveal index={next()}>
            <TwoToneHeading theme={theme} first="Recently" second="played" />
            <RecentRows theme={theme} songs={view.recent} onOpen={openSong} />
          </Reveal>
        ) : null}

        {!view.hero ? (
          <Text style={[styles.empty, { color: theme.textBody }]}>Loading today's song…</Text>
        ) : null}
        <View style={styles.tail} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.section },
  empty: { textAlign: "center" },
  tail: { height: 140 },
})
