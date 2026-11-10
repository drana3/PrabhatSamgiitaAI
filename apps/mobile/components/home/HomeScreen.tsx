import { useEffect, useMemo, useState } from "react"
import { AppState, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated"
import type { TodayRecommendationItem, TodayRecommendations } from "@prabhat/core"

import {
  HOME_INSET,
  HomeEmpty,
  HomeOffline,
  HomePagedRows,
  HomeRow,
  HomeSectionHead,
  HomeShelf,
  HomeSkeleton,
  HomeTodayCard,
  HomeTopRow,
  SquareCard,
  StripCard,
  type HomeRowData,
  type StripCardData,
} from "@/components/home/HomeBlocks"
import { FestivalEvePanel } from "@/components/festivals/FestivalEvePanel"
import { LiveNowStrip } from "@/components/kirtan/LiveNowStrip"
import { KirtanMenuSheet } from "@/components/kirtan/KirtanMenus"
import { KirtanRow } from "@/components/kirtan/KirtanParts"
import { chipColorsOf, StickyChipsRow, StickyTopBlock } from "@/components/nav-v2/StickyChips"
import { RowMenuSheet } from "@/components/songs-v2/CatalogSheets"
import { Toast } from "@/components/songs-v2/Toast"
import { TodayListeningExtras } from "@/components/today/TodayListeningExtras"
import { Reveal } from "@/components/today/motion"
import { fixtureDay } from "@/components/today/TodayPrototypeScreen"
import { songCategories } from "@/constants/categories"
import { amProto, protoFor } from "@/constants/tokens/amToday"
import { getUpcomingFestivals } from "@/data/festivals"
import { festivalSongCount } from "@/data/festivalSongs"
import { todayFestivalCards } from "@/lib/festivals/todayCard"
import { sampleSpiritualSongs } from "@/lib/fixtures/todaySpiritual"
import { spiritualForToday, spiritualNewlyAdded } from "@/lib/spiritualToday"
import { SpiritualForToday, SpiritualNewlyAdded } from "@/components/today/TodaySpiritualShelves"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtanLive } from "@/hooks/useKirtanLive"
import { useKirtans } from "@/hooks/useKirtans"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { ensureCatalog, useCatalogStore } from "@/lib/catalogStore"
import { useLanguage, useT } from "@/lib/i18n"
import { festivalText } from "@/lib/i18n/festivalText"
import { festivalPhase } from "@/lib/festivalEve"
import { nowMs } from "@/lib/notifications/clock"
import { api } from "@/lib/client"
import {
  HOME_BECAUSE,
  HOME_BECAUSE_OF,
  HOME_LEARN,
  HOME_MIXES,
  HOME_RECENT_NUMBERS,
  HOME_RESUME,
  HOME_STORIES,
  HOME_TRENDING,
  homeSong,
} from "@/lib/fixtures/home"
import { HOME_FILTERS, interleave, mergeStartRows, mixKindsFor, shelvesFor, songSub, type HomeFilterId, type HomeShelfId, type StartRow } from "@/lib/homeShelves"
import { sampleMixes } from "@/lib/fixtures/kirtanGate"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { mixCaption } from "@/lib/kirtan/mix"
import { photoForMix } from "@/lib/photos/catalog"
import { dayNumberOf, kiirtanOfTheDay } from "@/lib/kirtan/resume"
import { playEverything, playKiirtans, playMix } from "@/lib/kirtan/mixPlayback"
import type { Kirtan } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { songPlayback } from "@/lib/playback"
import { readableTitle } from "@/lib/readableTitle"
import { songSummaryToMockSong } from "@/lib/songMap"
import { placeholderEntry } from "@/lib/songsV2/entry"
import { buildTodayDay, formatDayLineShort } from "@/lib/todayDay"
import { todayItemToMockSong } from "@/lib/today"
import { readTodayCache, refreshTodayRecommendations } from "@/lib/todayCache"
import { buildTodayView, storyOfTheWeek } from "@/lib/todayView"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useResumeStore } from "@/stores/resumeStore"
import type { MockSong } from "@/data/mock"
import { href } from "@/utils/href"

/** Row 1 (avatar, search, bell): height of the icon row inside the pinned block. */
const TOP_ROW = 60
const SECTION_GAP = 36
const MIX_WIDTH = 250
const STORY_WIDTH = 250

/** MockSong of a row (title and number are all the player needs to start it). */
function mockSongOf(row: { number: number; title: string }): MockSong {
  return songSummaryToMockSong({ number: row.number, title: row.title, first_line: row.title, is_verified: true })
}

/**
 * Home (Today tab), shelf style: a top row with the avatar, filter chips, search and the bell, then
 * the song of the day and vertical shelves ("Start listening", "To get you started", "Because you
 * listened to PS 3", "Rising this week", stories, learn). A chip decides which shelves show; a shelf
 * without data is left out. The preview (MOCKUP_DATA) fills every shelf with sample content.
 * The Claude prototype's Today stays at /today?layout=prototype.
 */
export function HomeScreen() {
  const bottomInset = useScrollBottomInset()
  const t = useT()
  const language = useLanguage()
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const songsTheme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const top = insets.top || amProto.statusArea
  const [filter, setFilter] = useState<HomeFilterId>("all")

  const now = useMemo(() => new Date(), [])
  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const actions = useSongsV2Actions()
  const { unread } = useNotificationItems()

  const [today, setToday] = useState<TodayRecommendations | null>(null)
  /** the first load of the day's songs: running, done, or failed with nothing saved to show */
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">(MOCKUP_DATA ? "ready" : "loading")
  const [attempt, setAttempt] = useState(0)
  const [recommended, setRecommended] = useState<MockSong[]>([])
  const [stories, setStories] = useState<StorySummary[]>([])
  const [menu, setMenu] = useState<{ number: number; title: string } | null>(null)
  const kActions = useKirtanActions()
  const { playable: kirtans } = useKirtans()
  const liveNowItem = useKirtanLive().current
  const kSavedIds = useKirtanStore((s) => s.savedIds)
  const [kMenu, setKMenu] = useState<Kirtan | null>(null)

  useEffect(() => {
    if (MOCKUP_DATA) return
    let active = true
    setPhase((current) => (current === "ready" ? current : "loading"))
    const apply = (value: TodayRecommendations) => {
      const songs = (value.recommendations ?? []).slice(0, 8).map((item: TodayRecommendationItem, i: number) => todayItemToMockSong(item, i))
      if (!active) return
      setToday(value)
      if (songs.length) setRecommended(songs)
    }
    void (async () => {
      const cached = await readTodayCache()
      if (cached) {
        apply(cached)
        if (active) setPhase("ready")
      }
      const result = await refreshTodayRecommendations()
      if (result.today) {
        apply(result.today)
        if (active) setPhase("ready")
        return
      }
      await ensureCatalog()
      const rows = useCatalogStore.getState().rows
      if (active && rows.length) setRecommended(rows.slice(0, 8).map((row, i) => songSummaryToMockSong(row, i)))
      // nothing from the server, nothing saved: say so instead of leaving a hole
      if (active) setPhase(rows.length || cached ? "ready" : "failed")
    })()
    void api.fetchStories({ limit: 12 }).then((rows) => {
      if (active) setStories(rows.map(mapApiStory))
    })
    return () => {
      active = false
    }
  }, [attempt])

  const initials = useProfileInitial()
  const view = useMemo(() => buildTodayView({ recommended, recentPlays, now }), [recommended, recentPlays, now])

  /* --- the day and the song of the day --- */
  const sample = useMemo(() => (MOCKUP_DATA ? fixtureDay("date", 3) : null), [t])
  const day = sample?.day ?? buildTodayDay(today, now)
  const hero = sample ? sample.rows[0] : recommended[0] ? { song: recommended[0], meta: `PS ${recommended[0].number}`, firstLine: "", length: undefined } : null
  const todayRows: StartRow[] = sample
    ? sample.rows.map((r) => ({ number: Number(r.song.number), title: r.song.title, sub: songSub(Number(r.song.number), r.length) }))
    : recommended.slice(0, 3).map((song) => ({ number: Number(song.number), title: readableTitle(song.title), sub: songSub(Number(song.number)) }))

  /* --- shelves --- */
  const startRows = useMemo(() => {
    if (MOCKUP_DATA) {
      return mergeStartRows([[HOME_RESUME], HOME_RECENT_NUMBERS.map((n) => ({ ...homeSong(n) })), todayRows])
    }
    const resume = view.resume?.kind === "resume" ? [{ number: Number(view.resume.song.number), title: readableTitle(view.resume.song.title), sub: songSub(Number(view.resume.song.number)) }] : []
    const recent = view.recent.map((song) => ({ number: Number(song.number), title: readableTitle(song.title), sub: songSub(Number(song.number)) }))
    return mergeStartRows([resume, recent, todayRows])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sample, recommended])

  const mixes: (StripCardData & { browseId: string; numbers: number[] })[] = useMemo(() => {
    if (MOCKUP_DATA) return HOME_MIXES.map((m) => ({ id: m.id, label: m.label, tone: m.tone, cover: m.cover, caption: m.caption, browseId: m.browseId, numbers: m.numbers }))
    const made: (StripCardData & { browseId: string; numbers: number[] })[] = []
    if (todayRows.length) {
      made.push({ id: "today", label: t("home.mix.today"), tone: "orange", cover: todayRows[0].number, caption: todayRows.map((r) => r.title).join(", "), browseId: "today", numbers: todayRows.map((r) => r.number) })
    }
    const tones = ["sage", "gold", "forest", "sage"] as const
    ;["morning", "evening", "festival", "meditation"].forEach((id, i) => {
      const count = songNumbersForCategory(id).length
      const label = songCategories.find((c) => c.id === id)?.label
      if (count > 0 && label) made.push({ id, label: t("home.mix.category", { label }), tone: tones[i], cover: songNumbersForCategory(id)[0] ?? i, caption: t("home.mix.count", { count }), browseId: id, numbers: [] })
    })
    return made
  }, [todayRows, t])

  const storyCards: (StripCardData & { slug: string })[] = useMemo(() => {
    if (MOCKUP_DATA) return HOME_STORIES.map((st) => ({ id: st.slug, slug: st.slug, label: st.eyebrow, tone: "sage" as const, cover: st.cover, title: st.title, caption: st.blurb }))
    return stories.slice(0, 6).map((st, i) => ({ id: st.slug, slug: st.slug, label: t("today.section.story"), tone: "sage" as const, cover: i + 1, title: st.title, caption: st.teaser }))
  }, [stories, t])
  const storyOfWeek = useMemo(() => storyOfTheWeek(stories, now), [stories, now])
  void storyOfWeek

  const learnCards: (StripCardData & { target: string })[] = useMemo(
    () =>
      HOME_LEARN.map((c) => ({
        id: c.id,
        label: t(`home.learn.${c.id as "words" | "quiz" | "paths"}.title`),
        tone: c.tone,
        cover: c.cover,
        caption: MOCKUP_DATA ? c.caption : t(`home.learn.${c.id as "words" | "quiz" | "paths"}.caption`),
        target: c.target,
      })),
    [t],
  )

  /* --- actions --- */
  const goPlayer = () => router.navigate(href("/player-v2"))
  const listen = (row: { number: number; title: string }, queue?: number[]) => {
    const song = mockSongOf(row)
    const wasPlaying = songPlayback(usePlayerStore.getState(), song).showPause
    playOrToggle(song, queue)
    if (!wasPlaying) goPlayer()
  }
  const openSong = (row: { number: number }) => router.push(href(`/song-v2/ps-${row.number}`))
  const heroPlaying = hero ? songPlayback({ currentSong, isPlaying, isBuffering: false }, hero.song).showPause : false
  const saved = useMemo(() => new Set(savedSongIds.map((s) => Number(s.replace(/^ps-/i, "")))), [savedSongIds])
  const menuEntry = menu ? placeholderEntry(menu.number, menu.title) : null

  const openMix = (mix: { id: string; browseId: string; label: string; numbers: number[] }) => {
    if (mix.browseId === "today") {
      if (mix.numbers.length) listen({ number: mix.numbers[0], title: todayRows.find((r) => r.number === mix.numbers[0])?.title ?? "" }, mix.numbers)
      return
    }
    router.push(href(`/songs-v2-collection?id=${encodeURIComponent(mix.browseId)}&title=${encodeURIComponent(mix.label)}`))
  }

  /* --- Kiirtans and mixes: one queue with the songs --- */
  const mixCards: StripCardData[] = useMemo(
    () => sampleMixes().map((m) => ({ id: m.id, label: m.title, tone: m.tone, cover: m.cover, photo: photoForMix(m.id).cover, caption: `${mixCaption(m.items, t)}. ${m.blurb}` })),
    [t],
  )
  const kiirtanToday = useMemo(() => {
    const first = kiirtanOfTheDay(kirtans, dayNumberOf(now.getTime()))
    if (!first) return []
    const rest = kirtans.filter((k) => k.id !== first.id).slice(0, 2)
    return [first, ...rest]
  }, [kirtans, now])
  const playMixCard = (id: string) => {
    const mix = sampleMixes().find((m) => m.id === id)
    if (mix) kActions.flash(playMix(mix) ?? t("home.playing", { title: mix.title }))
  }
  /** ONE shelf of mixes: the Prabhat Samgiita mixes and the Kiirtan mixes in turns (Songs shows the first kind, Kiirtan the second). */
  const mixShelf = (() => {
    const kinds = mixKindsFor(filter)
    const ps = kinds.songs ? mixes.map((m) => ({ key: `ps-${m.id}`, card: m as StripCardData, press: () => openMix(m) })) : []
    const kk = kinds.kiirtan ? mixCards.map((m) => ({ key: `kk-${m.id}`, card: m, press: () => playMixCard(m.id) })) : []
    return interleave(ps, kk)
  })()

  /* --- spiritual songs: Today shows them next to Prabhat Samgiita and Kiirtan (lib/spiritualToday.ts) --- */
  const spiritualPool = useMemo(() => [...kirtans, ...sampleSpiritualSongs()], [kirtans])
  const spiritualToday = useMemo(() => spiritualForToday(spiritualPool, dayNumberOf(now.getTime())), [spiritualPool, now])
  const spiritualNew = useMemo(() => spiritualNewlyAdded(spiritualPool, spiritualToday), [spiritualPool, spiritualToday])
  const openSpiritual = (k: Kirtan, context: readonly Kirtan[]) => kActions.open(k, context, t("home.spiritual.today.first"))

  const onKirtanShare = async (k: Kirtan, target: ShareTargetId) => {
    const message = shareToast(await runShare(target, kirtanSharePayload(k)))
    if (message) kActions.flash(message)
  }

  /* --- scroll-linked header: row 1 (avatar, search, bell) and the chips are ONE pinned block; its hairline fades in --- */
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  const chipColors = chipColorsOf(p)

  /*
   * Only observances with confirmed dates (data/festivals.ts). The day before a festival, and on the day, the
   * card says "Tomorrow" / "Today" and the shelf opens with that festival's Prabhat Samgiita (lib/festivalEve.ts).
   * The date is the phone's local day, read again whenever the app comes back to the front. In the web preview
   * `?at=2026-11-07T10:00` moves the clock (lib/notifications/clock.ts); everywhere else it is the real one.
   */
  const [clock, setClock] = useState(() => nowMs())
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setClock(nowMs())
    })
    return () => sub.remove()
  }, [])
  const festivalNow = useMemo(() => new Date(clock), [clock])
  /** The festival card (first block): a festival with confirmed songs, two days before, the day before and on the day. */
  const cardList = useMemo(() => todayFestivalCards(festivalNow), [festivalNow])
  /** The calendar shelf lists the festivals the card does not already show; the Festivals chip shows more of them. */
  const festivalCards: StripCardData[] = useMemo(
    () =>
      getUpcomingFestivals(festivalNow, filter === "festivals" ? 12 : 4 + cardList.length)
        .filter((f) => !cardList.some((c) => c.pageId === f.id))
        .slice(0, filter === "festivals" ? 12 : 4)
        .map((f, i) => {
          const phase = festivalPhase(f.daysUntil)
          const songs = phase ? festivalSongCount(f) : 0
          return {
            id: f.id,
            label: `${phase ? `${phase === "today" ? t("fest.today") : t("fest.tomorrow")} · ${f.dateLabel}` : f.dateLabel}${f.expected ? ` · ${t("fest.expected")}` : ""}`,
            tone: (["orange", "sage", "gold", "forest"] as const)[i % 4],
            cover: i + 3,
            title: festivalText(f, language).title,
            caption:
              songs > 0
                ? t("festSongs.card.caption", { count: songs })
                : f.daysUntil === 0
                  ? t("fest.today")
                  : f.daysUntil === 1
                    ? t("fest.tomorrow")
                    : t("fest.inDays", { count: f.daysUntil }),
          }
        }),
    [festivalNow, t, language, filter, cardList],
  )

  const shelves = shelvesFor(filter)
  const has: Record<HomeShelfId, boolean> = {
    festcard: cardList.length > 0,
    today: Boolean(hero),
    start: startRows.length > 0,
    kiirtan: kiirtanToday.length > 0,
    mixes: mixShelf.length > 0,
    spiritual: spiritualToday.length > 0,
    spiritualNew: spiritualNew.length > 0,
    because: MOCKUP_DATA,
    trending: MOCKUP_DATA,
    stories: storyCards.length > 0,
    learn: true,
    festivals: festivalCards.length > 0,
  }
  const visible = shelves.filter((id) => has[id])
  let reveal = 1
  const next = () => Math.min(reveal++, 8)

  const section = (id: HomeShelfId): ReactNodeOrNull => {
    switch (id) {
      case "festcard":
        return (
          <Reveal key={id} index={next()}>
            <View style={styles.list}>
              {cardList.map((festival) => (
                <FestivalEvePanel key={festival.id} p={p} festival={festival} now={festivalNow} onSeeAll={(pageId) => router.push(href(`/festival/${pageId}`))} />
              ))}
            </View>
          </Reveal>
        )
      case "today":
        return hero ? (
          <Reveal key={id} index={next()}>
            <HomeTodayCard
              p={p}
              dateLabel={width < 400 ? formatDayLineShort(now) : day.dateLabel}
              kind={day.kind}
              kindLabel={day.kindLabel}
              note={day.note || day.tag}
              meta={`PS ${hero.song.number}${hero.length ? ` · ${hero.length}` : ""}`}
              title={hero.song.title}
              playing={heroPlaying}
              onOpen={() => openSong({ number: Number(hero.song.number) })}
              onListen={() => listen({ number: Number(hero.song.number), title: hero.song.title }, todayRows.map((r) => r.number))}
            />
          </Reveal>
        ) : null
      case "start":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow={t("home.start.eyebrow")} first={t("home.start.first")} second={t("home.start.second")} />
            <HomePagedRows p={p} rows={startRows} onOpen={openSong} onMore={(row) => setMenu({ number: row.number, title: row.title })} />
          </Reveal>
        )
      case "kiirtan":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow={t("home.kiirtan.eyebrow")} first={t("tabs.kiirtan")} second={t("today.title.second")} />
            <View style={styles.list}>
              {kiirtanToday.map((k) => (
                <KirtanRow
                  key={k.id}
                  theme={songsTheme}
                  kirtan={k}
                  onOpen={(row) => kActions.flash(playKiirtans(kirtans, row.id) ?? "")}
                  onMore={setKMenu}
                  onOpenArtist={(a) => router.push(href(`/kirtan-artist?id=${encodeURIComponent(a)}`))}
                />
              ))}
            </View>
          </Reveal>
        )
      case "mixes":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead
              p={p}
              eyebrow={t("home.kmixes.eyebrow")}
              first={t("home.kmixes.first")}
              second={t("home.kmixes.second")}
              action={mixKindsFor(filter).kiirtan ? { label: t("home.shuffle"), onPress: () => kActions.flash(playEverything() ?? t("home.shuffling")) } : undefined}
            />
            <HomeShelf itemWidth={MIX_WIDTH}>
              {mixShelf.map((mix) => (
                <StripCard key={mix.key} p={p} card={mix.card} width={MIX_WIDTH} height={170} onPress={mix.press} />
              ))}
            </HomeShelf>
          </Reveal>
        )
      case "spiritual":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <SpiritualForToday
              p={p}
              theme={songsTheme}
              items={spiritualToday}
              onOpen={openSpiritual}
              onMore={setKMenu}
              onOpenArtist={(a) => router.push(href(`/kirtan-artist?id=${encodeURIComponent(a)}`))}
              onAll={() => router.push(href("/browse-shelf?id=spiritual"))}
            />
          </Reveal>
        )
      case "spiritualNew":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <SpiritualNewlyAdded p={p} theme={songsTheme} items={spiritualNew} onOpen={openSpiritual} onAll={() => router.push(href("/browse-shelf?id=spiritual"))} />
          </Reveal>
        )
      case "because":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow={t("home.because.eyebrow")} first={t("home.because.first")} second={t("home.because.second", { number: HOME_BECAUSE_OF })} />
            <HomeShelf itemWidth={156}>
              {HOME_BECAUSE.map((row) => (
                <SquareCard key={row.number} p={p} row={row} onPress={() => openSong(row)} />
              ))}
            </HomeShelf>
          </Reveal>
        )
      case "trending":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow={t("home.trending.eyebrow")} first={t("home.trending.first")} second={t("home.trending.second")} />
            <View style={styles.list}>
              {HOME_TRENDING.map((row) => (
                <HomeRow key={row.number} p={p} row={row} rank={row.rank} onOpen={() => openSong(row)} onMore={() => setMenu({ number: row.number, title: row.title })} />
              ))}
            </View>
          </Reveal>
        )
      case "stories":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow={t("home.stories.eyebrow")} first={t("home.filter.stories")} second={t("home.stories.second")} />
            <HomeShelf itemWidth={STORY_WIDTH}>
              {storyCards.map((card) => (
                <StripCard key={card.id} p={p} card={card} width={STORY_WIDTH} height={150} onPress={() => router.push(href(`/story-sheet/${card.slug}`))} />
              ))}
            </HomeShelf>
          </Reveal>
        )
      case "learn":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow={t("home.learn.eyebrow")} first={t("tabs.learn")} second={t("home.learn.second")} />
            <HomeShelf itemWidth={MIX_WIDTH}>
              {learnCards.map((card) => (
                <StripCard key={card.id} p={p} card={card} width={MIX_WIDTH} height={170} onPress={() => router.push(href(card.target))} />
              ))}
            </HomeShelf>
          </Reveal>
        )
      case "festivals":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead
              p={p}
              eyebrow={t("home.festivals.eyebrow")}
              first={t("home.festivals.first")}
              second={t("home.festivals.second")}
              action={{ label: t("home.festivals.all"), onPress: () => router.push(href("/festivals")) }}
            />
            <HomeShelf itemWidth={STORY_WIDTH}>
              {festivalCards.map((card) => (
                <StripCard key={card.id} p={p} card={card} width={STORY_WIDTH} height={150} onPress={() => router.push(href(`/festival/${card.id}`))} />
              ))}
            </HomeShelf>
          </Reveal>
        )
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: p.sand200 }]}>
      {/* The first child is the pinned block: status inset, row 1 and the chips, opaque in the page colour. */}
      <Animated.ScrollView
        style={styles.root}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      >
        <StickyTopBlock inset={top} rowHeight={TOP_ROW} page={p.sand200} wash={p.dark ? ["rgba(74, 46, 28, 0.6)", "rgba(74, 46, 28, 0)"] : [p.orange100, "rgba(255, 220, 197, 0)"]} scrollY={scrollY}>
          <HomeTopRow
            p={p}
            initial={initials}
            unread={unread > 0}
            onAvatar={() => router.push(href("/profile-sheet"))}
            onBell={() => router.push(href("/notifications"))}
            onSearch={() => router.push(href("/search-v2?focus=1"))}
          />
          <StickyChipsRow items={HOME_FILTERS} value={filter} onChange={setFilter} colors={chipColors} scrollY={scrollY} stickAt={0} />
        </StickyTopBlock>

        <View style={styles.shelves}>
          {liveNowItem ? <LiveNowStrip item={liveNowItem} onOpen={(i) => router.push(href(`/kiirtan-live?id=${encodeURIComponent(i.id)}`))} /> : null}
          {!MOCKUP_DATA && !hero && phase === "loading" ? <HomeSkeleton p={p} /> : null}
          {!MOCKUP_DATA && !hero && phase === "failed" ? <HomeOffline p={p} onRetry={() => setAttempt((n) => n + 1)} /> : null}
          {visible.map((id) => section(id))}
          <TodayListeningExtras p={p} filter={filter} />
          {visible.length === 0 && (MOCKUP_DATA || phase === "ready") ? <HomeEmpty p={p} text={t("home.empty")} /> : null}
        </View>
      </Animated.ScrollView>

      <RowMenuSheet
        open={Boolean(menu)}
        theme={songsTheme}
        entry={menuEntry}
        saved={menu ? saved.has(menu.number) : false}
        onQueue={actions.queue}
        onToggleSave={actions.toggleSave}
        onShare={actions.share}
        onClose={() => setMenu(null)}
      />
      <KirtanMenuSheet
        open={Boolean(kMenu)}
        theme={songsTheme}
        kirtan={kMenu}
        saved={kMenu ? kSavedIds.includes(kMenu.id) : false}
        onPlayNext={kActions.playNext}
        onAddToPlaylist={kActions.addToPlaylist}
        onToggleSave={kActions.toggleSaved}
        onShare={(k) => void onKirtanShare(k, "copy")}
        onClose={() => setKMenu(null)}
      />
      <Toast message={kActions.toast ?? actions.toast} theme={songsTheme} />
    </View>
  )
}

type ReactNodeOrNull = React.ReactNode

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 200 },
  shelves: { paddingTop: 12, gap: SECTION_GAP },
  section: { gap: 16 },
  list: { paddingHorizontal: HOME_INSET, gap: 8 },
})
