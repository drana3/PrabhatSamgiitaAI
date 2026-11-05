import { useEffect, useMemo, useState } from "react"
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Frost } from "@/components/common/Frost"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
  Extrapolation,
} from "react-native-reanimated"
import type { TodayRecommendationItem, TodayRecommendations } from "@prabhat/core"

import { Reveal } from "@/components/today/motion"
import {
  TODAY_SETS,
  TodayAvatar,
  TodayCardButton,
  TodayHead,
  TodayHeader,
  TodayHeroPanel,
  TodayList,
  TodayMockupPanel,
  TodayPlayAll,
  TodayQuickTiles,
  TodayRecentRow,
  TodayResumeCard,
  TodaySearchField,
  TodaySectionHeading,
  TodaySetContext,
  TodaySongPill,
  TodayStoryCard,
  type SampleDayKind,
  type TodaySet,
} from "@/components/today/TodayBlocks"
import { amProto, protoFor } from "@/constants/tokens/amToday"
import type { MockSong } from "@/data/mock"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { loadCatalog } from "@/lib/catalog"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { api } from "@/lib/client"
import { TODAY_FIXTURE_DAYS, TODAY_FIXTURE_RECENT, TODAY_FIXTURE_SONGS } from "@/lib/fixtures/today"
import { t as tPlain, useT } from "@/lib/i18n"
import { formatClock } from "@/lib/navV2"
import { songPlayback } from "@/lib/playback"
import { readableTitle } from "@/lib/readableTitle"
import { songSummaryToMockSong } from "@/lib/songMap"
import {
  buildTodayDay,
  formatDayLine,
  resumeLine,
  sampleDayStart,
  searchHref,
  todayQuickIntro,
  TODAY_QUICK_SEARCHES,
  type TodayDay,
} from "@/lib/todayDay"
import { todayItemToMockSong } from "@/lib/today"
import { readTodayCache, refreshTodayRecommendations } from "@/lib/todayCache"
import { buildTodayView, resumeProgress, storyOfTheWeek } from "@/lib/todayView"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useResumeStore } from "@/stores/resumeStore"
import { href } from "@/utils/href"

/** How many songs Today offers: the hero and two more (prototype `tcount`). */
const SONGS_PER_DAY = 3
const REVEAL_EASING = Easing.bezier(0.2, 0.7, 0.2, 1)
/** Scroll offset where the search field reaches the top of the page and sticks. */
const STICK_AT = amProto.headHeight
const NARROW_FROM = 6

export type TodayRow = {
  song: MockSong
  /** "PS 1 · composed 1982" */
  meta: string
  /** the meta line already says when the song was composed, so the length is not added */
  composed?: boolean
  firstLine: string
  /** a real length, when we have one */
  length?: string
}

function firstLineOf(song: MockSong): string {
  const line = (song.lyrics ?? "").trim()
  if (!line || line.length > 90) return ""
  return line.toLowerCase() === song.title.trim().toLowerCase() ? "" : line
}

/** Song rows built from the design prototype's sample day (?day=fest, for design review only). */
export function fixtureDay(kind: "date" | "fest" | "season", count: number) {
  const def = TODAY_FIXTURE_DAYS[kind]
  const now = "date" in def ? def.date : new Date(2026, 10, 1)
  const toRow = (index: number, composed?: string): TodayRow => {
    const fix = TODAY_FIXTURE_SONGS[index]
    const song = songSummaryToMockSong({ number: fix.number, title: fix.title, first_line: fix.firstLine, is_verified: true })
    return {
      song,
      meta: composed ? `PS ${fix.number} · ${tPlain("today.composed", { year: composed })}` : `PS ${fix.number}`,
      composed: Boolean(composed),
      // the prototype's sample lyrics are one text for every song (`_content(i).lines[0]`)
      firstLine: "Bandhu he niye calo",
      length: formatClock(fix.seconds),
    }
  }
  const rows = def.songs.slice(0, count).map((n, i) => toRow(n, def.composed[i]))
  const context =
    kind === "fest"
      ? { festival: "Díipávalii", recommendation_mode: "strict_festival" }
      : kind === "season"
        ? { season: "Hemanta", recommendation_mode: "season" }
        : {}
  const day = buildTodayDay({ context, signals: [], recommendations: [], disclaimer: "" } as unknown as TodayRecommendations, now)
  const alsoRow = def.also != null ? toRow(def.also) : null
  const tag = kind === "date" && def.composed[0] ? tPlain("today.tag.composed", { year: def.composed[0] }) : day.tag
  const note = "note" in def ? def.note : day.note
  return { rows, day: { ...day, dateLabel: formatDayLine(now), tag, note }, also: alsoRow }
}

/**
 * Today (spec SCR-10; prototype `<!-- TODAY -->`, Main.dc.html lines 1010-1124). The daily ritual in under
 * 30 seconds: the songs of this day, where you stopped, three ways to search, one story, what you played.
 * Colours are the prototype's "Dawn" set (light) and the dark theme.
 */
export default function TodayScreen() {
  const bottomInset = useScrollBottomInset()
  const t = useT()
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const reduce = useReducedMotion()
  const params = useLocalSearchParams<{ day?: string; count?: string; tc?: string }>()
  // MOCKUP_DATA (preview builds only): the prototype's own sample day, as on its Today board, and its
  // "Mockup only" switches for another day and another colour set (`?day=` and `?tc=` start them).
  // In a real build `?day=` does nothing: no sample day can be opened by a link.
  const startKind: SampleDayKind | null = sampleDayStart(MOCKUP_DATA, params.day)
  const [pickedKind, setPickedKind] = useState<SampleDayKind | null>(null)
  const sampleKind = pickedKind ?? startKind
  const startSet = TODAY_SETS.find(([id]) => id === params.tc)?.[0] ?? "3"
  const [pickedSet, setPickedSet] = useState<TodaySet | null>(null)
  const set: TodaySet = MOCKUP_DATA ? (pickedSet ?? startSet) : "3"
  const songCount = Math.min(3, Math.max(1, Number(params.count) || SONGS_PER_DAY))
  // the prototype's status area is 54dp; a phone reports its own inset, the browser reports 0
  const top = insets.top || amProto.statusArea

  const now = useMemo(() => new Date(), [])
  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const resumeEntries = useResumeStore((s) => s.entries)
  const mode = useAuthStore((s) => s.mode)

  const [today, setToday] = useState<TodayRecommendations | null>(null)
  const [recommended, setRecommended] = useState<MockSong[]>([])
  const [stories, setStories] = useState<StorySummary[]>([])

  useEffect(() => {
    let active = true
    const apply = (value: TodayRecommendations) => {
      const songs = (value.recommendations ?? []).slice(0, 8).map((item: TodayRecommendationItem, i: number) => todayItemToMockSong(item, i))
      if (!active) return
      setToday(value)
      if (songs.length) setRecommended(songs)
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
  const initials = useProfileInitial()

  // `t` changes with the language, so the sample day is rebuilt in the new language
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sample = useMemo(() => (sampleKind ? fixtureDay(sampleKind, songCount) : null), [sampleKind, songCount, t])
  // TODO(api): the prototype's sample story card (Main.dc.html 1085-1090) while a sample day is shown
  const story = useMemo(
    () =>
      sample
        ? ({ slug: "ps-3", title: "The story behind PS 3", teaser: "Placeholder blurb from the stories database." } as StorySummary)
        : storyOfTheWeek(stories, now),
    [sample, stories, now],
  )
  const day: TodayDay = sample?.day ?? buildTodayDay(today, now)
  const rows: TodayRow[] = useMemo(
    () =>
      sample
        ? sample.rows
        : recommended.slice(0, songCount).map((song) => ({ song, meta: `PS ${song.number}`, firstLine: firstLineOf(song) })),
    [sample, recommended, songCount],
  )
  const hero = rows[0] ?? null
  const more = rows.slice(1)
  const also = sample?.also ?? null

  // TODO(api): ?day= design-review mode shows the prototype's sample "pick up" card (PS 6, 1:12 of 5:00)
  const sampleResume = useMemo(() => {
    if (!sample) return null
    const fix = TODAY_FIXTURE_SONGS[5]
    return songSummaryToMockSong({ number: fix.number, title: fix.title, first_line: fix.firstLine, is_verified: true })
  }, [sample])
  const resumeSong = sampleResume ?? (view.resume?.kind === "resume" ? view.resume.song : null)
  const resumeIsCurrent = resumeSong != null && currentSong?.number === resumeSong.number
  const saved = resumeSong ? resumeEntries[String(resumeSong.number)] : undefined
  const resumePos = sampleResume ? 72 : resumeIsCurrent ? position : (saved?.position ?? 0)
  const resumeDur = sampleResume ? 300 : resumeIsCurrent ? duration : (saved?.duration ?? 0)

  // TODO(api): ?day= design-review mode lists the prototype's sample recent plays with their lengths
  const recentRows = useMemo(
    () =>
      sample
        ? TODAY_FIXTURE_RECENT.map((index) => {
            const fix = TODAY_FIXTURE_SONGS[index]
            const song = songSummaryToMockSong({ number: fix.number, title: fix.title, first_line: fix.firstLine, is_verified: true })
            return { song, length: formatClock(fix.seconds) as string | undefined }
          })
        : view.recent.map((song) => ({ song, length: undefined as string | undefined })),
    [sample, view.recent],
  )

  const goPlayer = () => router.navigate(href("/player-v2"))
  /** Play, and show the player, like the prototype's `_play(i); _go('player')`. */
  const listen = (song: MockSong, queue?: number[]) => {
    const state = usePlayerStore.getState()
    const wasPlaying = songPlayback(state, song).showPause
    playOrToggle(song, queue)
    if (!wasPlaying) goPlayer()
  }
  const openSong = (song: MockSong) => router.push(href(`/song-v2/${song.id}`))
  const heroPlaying = hero ? songPlayback({ currentSong, isPlaying, isBuffering: false }, hero.song).showPause : false

  /* --- scroll-linked header: the search field narrows, then sticks under the status bar --- */
  const scrollY = useSharedValue(0)
  const narrow = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  useAnimatedReaction(
    () => scrollY.value > NARROW_FROM,
    (isNarrow, was) => {
      if (isNarrow === was) return
      narrow.value = reduce ? (isNarrow ? 1 : 0) : withTiming(isNarrow ? 1 : 0, { duration: 200, easing: REVEAL_EASING })
    },
  )
  // `.pstk.nar .pillfield{width:calc(100% - 76px)}`: the field makes room for the avatar
  const fieldStyle = useAnimatedStyle(() => ({ width: width - 2 * amProto.gutter - narrow.value * 56 }))
  const stuckStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [STICK_AT - 12, STICK_AT], [0, 1], Extrapolation.CLAMP),
  }))
  // the dawn wash scrolls away with the page; the status strip fades with it
  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, STICK_AT], [1, 0], Extrapolation.CLAMP),
  }))

  const dawn = !p.dark && set === "3"
  const bg = p.sand200

  return (
    <TodaySetContext.Provider value={set}>
    <View style={[styles.root, { backgroundColor: bg }]}>
      {dawn ? (
        <Animated.View pointerEvents="none" style={[styles.statusWash, { height: top }, washStyle]}>
          <LinearGradient colors={[p.orange100, "rgba(255, 220, 197, 0.93)"]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}

      <Animated.ScrollView
        style={[styles.scroll, { marginTop: top }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[dawn ? 2 : 1]}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      >
        {dawn ? (
          <LinearGradient
            pointerEvents="none"
            colors={[p.orange100, "rgba(255, 220, 197, 0)"]}
            style={[styles.wash, { top: -top }]}
          />
        ) : null}

        <Reveal index={0}>
          <TodayHeader p={p} />
        </Reveal>

        <View style={styles.sticky}>
          <Animated.View pointerEvents="none" style={[styles.stickyBack, stuckStyle]}>
            <Frost intensity={60} tint={p.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: p.dark ? "rgba(18, 17, 16, 0.95)" : "rgba(238, 233, 229, 0.95)" }]} />
          </Animated.View>
          <Reveal index={1}>
            <Animated.View style={[styles.fieldWrap, Platform.OS === "web" ? null : null, fieldStyle]}>
              <TodaySearchField p={p} onPress={() => router.push(href("/search-v2?focus=1"))} width="100%" />
            </Animated.View>
          </Reveal>
        </View>

        <Reveal index={2}>
          <TodayHead p={p} dateLabel={day.dateLabel} kind={day.kind} kindLabel={day.kindLabel} note={day.note} />
        </Reveal>

        {hero ? (
          <>
            <Reveal index={3}>
              <TodayHeroPanel
                p={p}
                tag={day.tag}
                meta={`PS ${hero.song.number}${hero.length ? ` · ${hero.length}` : ""} · ${t("today.readLyrics")}`}
                title={hero.song.title}
                playing={heroPlaying}
                onOpen={() => openSong(hero.song)}
                onListen={() => listen(hero.song, rows.map((row) => Number(row.song.number)))}
              />
            </Reveal>

            {more.length ? (
              <Reveal index={5} style={{ marginTop: set === "2" && !p.dark ? 0 : 10 }}>
                <TodayList p={p}>
                {more.map((row, i) => (
                  <TodaySongPill
                    key={row.song.id}
                    p={p}
                    last={i === more.length - 1}
                    meta={`${row.meta}${row.length && !row.composed ? ` · ${row.length}` : ""}`}
                    title={readableTitle(row.song.title)}
                    firstLine={row.firstLine}
                    onOpen={() => openSong(row.song)}
                    onPlay={() => listen(row.song, rows.map((r) => Number(r.song.number)))}
                  />
                ))}
                <TodayPlayAll
                  p={p}
                  count={rows.length}
                  onPress={() => listen(hero.song, rows.map((row) => Number(row.song.number)))}
                />
                </TodayList>
              </Reveal>
            ) : null}

            {also && day.alsoLabel ? (
              <Reveal index={6} style={[styles.list, { marginTop: 10 }]}>
                <TodayCardButton p={p} label={day.alsoLabel} title={`PS ${also.song.number} · ${readableTitle(also.song.title)}`} onPress={() => openSong(also.song)} />
              </Reveal>
            ) : null}
          </>
        ) : (
          <Text style={[styles.empty, { color: p.ink500 }]}>{t("today.loading")}</Text>
        )}

        {resumeSong ? (
          <View style={styles.sect}>
            <Reveal index={2}>
              <TodaySectionHeading p={p} first={t("today.section.pickUp")} second={t("today.section.pickUp2")} />
            </Reveal>
            <Reveal index={3} style={styles.list}>
              <TodayResumeCard
                p={p}
                title={resumeSong.title}
                line={resumeLine({ number: resumeSong.number, position: resumePos, duration: resumeDur })}
                progress={resumeProgress(resumePos, resumeDur)}
                onPress={() => listen(resumeSong)}
              />
            </Reveal>
          </View>
        ) : null}

        <View style={styles.sect}>
          <Reveal index={4}>
            <TodaySectionHeading p={p} first={t("today.section.find")} second={t("today.section.find2")} />
          </Reveal>
          <Reveal index={4}>
            <Text style={[styles.intro, { color: p.ink500 }]}>{todayQuickIntro()}</Text>
          </Reveal>
          <Reveal index={5}>
            <TodayQuickTiles p={p} tiles={TODAY_QUICK_SEARCHES} onPress={(query) => router.push(href(searchHref(query)))} />
          </Reveal>
        </View>

        {story ? (
          <View style={styles.sect}>
            <Reveal index={6}>
              <TodaySectionHeading p={p} first={t("today.section.story")} second={t("today.section.story2")} />
            </Reveal>
            <Reveal index={7} style={styles.list}>
              <TodayStoryCard
                p={p}
                label={sample ? `${t("today.section.story")} · 4 min` : t("today.section.story")}
                title={story.title}
                blurb={story.teaser}
                onPress={() => router.push(href(`/story-sheet/${story.slug}`))}
              />
            </Reveal>
          </View>
        ) : null}

        {recentRows.length ? (
          <View style={styles.sect}>
            <Reveal index={8}>
              <TodaySectionHeading p={p} first={t("today.section.recent")} second={t("today.section.recent2")} />
            </Reveal>
            <Reveal index={9} style={styles.list}>
              {recentRows.map(({ song, length }) => (
                <TodayRecentRow key={song.id} p={p} number={song.number} title={readableTitle(song.title)} length={length} onPress={() => openSong(song)} />
              ))}
            </Reveal>
          </View>
        ) : null}
        {MOCKUP_DATA ? (
          <Reveal index={10}>
            <TodayMockupPanel
              p={p}
              day={sampleKind ?? "date"}
              onDay={setPickedKind}
              set={set}
              onSet={setPickedSet}
            />
          </Reveal>
        ) : null}
        <View style={styles.tail} />
      </Animated.ScrollView>

      <TodayAvatar_ p={p} top={top} initial={initials} onPress={() => router.push(href("/profile-sheet"))} />
    </View>
    </TodaySetContext.Provider>
  )
}

/** The avatar floats above the scroll, 6dp under the status area, and stays while the page moves. */
function TodayAvatar_({ p, top, initial, onPress }: { p: ReturnType<typeof protoFor>; top: number; initial: string; onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={[styles.avatarSlot, { top: top + 6 }]}>
      <TodayAvatar p={p} initial={initial} onPress={onPress} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusWash: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 190 },
  wash: { position: "absolute", left: 0, right: 0, height: 720 },
  sticky: { paddingBottom: 8, zIndex: 9 },
  stickyBack: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  fieldWrap: { marginHorizontal: amProto.gutter - amProto.gutter },
  list: { paddingHorizontal: amProto.gutter, gap: 10 },
  sect: { paddingTop: 40, gap: 20 },
  intro: {
    maxWidth: 309,
    paddingHorizontal: 20,
    paddingTop: 8,
    fontFamily: "Roboto_500Medium",
    fontSize: 16,
    lineHeight: 23.2,
    marginBottom: 0,
  },
  empty: { textAlign: "center", marginTop: 40 },
  tail: { height: 0 },
  avatarSlot: { position: "absolute", right: amProto.gutter, zIndex: 12 },
})
