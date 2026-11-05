import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from "react-native-reanimated"
import type { TodayRecommendationItem, TodayRecommendations } from "@prabhat/core"

import {
  HOME_INSET,
  HomeEmpty,
  HomePagedRows,
  HomeRow,
  HomeSectionHead,
  HomeShelf,
  HomeTodayCard,
  HomeTopRow,
  SquareCard,
  StripCard,
  type HomeRowData,
  type StripCardData,
} from "@/components/home/HomeBlocks"
import { KirtanMenuSheet } from "@/components/kirtan/KirtanMenus"
import { KirtanRow } from "@/components/kirtan/KirtanParts"
import { chipColorsOf, StickyChipsRow } from "@/components/nav-v2/StickyChips"
import { RowMenuSheet } from "@/components/songs-v2/CatalogSheets"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { fixtureDay } from "@/components/today/TodayPrototypeScreen"
import { songCategories } from "@/constants/categories"
import { amProto, protoFor } from "@/constants/tokens/amToday"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useNotificationItems } from "@/hooks/useNotificationItems"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { loadCatalog } from "@/lib/catalog"
import { api } from "@/lib/client"
import { memberProfileName } from "@/lib/displayName"
import {
  HOME_BECAUSE,
  HOME_BECAUSE_OF,
  HOME_DOWNLOADED_NUMBERS,
  HOME_LEARN,
  HOME_MIXES,
  HOME_RECENT_NUMBERS,
  HOME_RESUME,
  HOME_STORIES,
  HOME_TRENDING,
  homeSong,
} from "@/lib/fixtures/home"
import { HOME_FILTERS, mergeStartRows, shelvesFor, songSub, type HomeFilterId, type HomeShelfId, type StartRow } from "@/lib/homeShelves"
import { MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { mixCaption } from "@/lib/kirtan/mix"
import { dayNumberOf, kiirtanOfTheDay } from "@/lib/kirtan/resume"
import { playEverything, playKiirtans, playMix } from "@/lib/kirtan/mixPlayback"
import type { Kirtan } from "@/lib/kirtan/types"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { useKirtanStore } from "@/stores/kirtanStore"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { formatClock } from "@/lib/navV2"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { songPlayback } from "@/lib/playback"
import { readableTitle } from "@/lib/readableTitle"
import { songSummaryToMockSong } from "@/lib/songMap"
import { placeholderEntry } from "@/lib/songsV2/entry"
import { buildTodayDay } from "@/lib/todayDay"
import { todayItemToMockSong } from "@/lib/today"
import { readTodayCache, refreshTodayRecommendations } from "@/lib/todayCache"
import { buildTodayView, storyOfTheWeek } from "@/lib/todayView"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useResumeStore } from "@/stores/resumeStore"
import type { MockSong } from "@/data/mock"
import { href } from "@/utils/href"

/** Row 1 (avatar, search, bell): the part of the header that scrolls away. */
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
  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)
  const offlineFiles = useOfflineAudioStore((s) => s.files)
  const actions = useSongsV2Actions()
  const catalog = useSongsV2Catalog()
  const { unread } = useNotificationItems()

  const [today, setToday] = useState<TodayRecommendations | null>(null)
  const [recommended, setRecommended] = useState<MockSong[]>([])
  const [stories, setStories] = useState<StorySummary[]>([])
  const [menu, setMenu] = useState<{ number: number; title: string } | null>(null)
  const kActions = useKirtanActions()
  const { playable: kirtans } = useKirtans()
  const kSavedIds = useKirtanStore((s) => s.savedIds)
  const [kMenu, setKMenu] = useState<Kirtan | null>(null)

  useEffect(() => {
    if (MOCKUP_DATA) return
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
      const catalogResult = await loadCatalog()
      if (active && catalogResult.songs.length) setRecommended(catalogResult.songs.slice(0, 8).map((row, i) => songSummaryToMockSong(row, i)))
    })()
    void api.fetchStories({ limit: 12 }).then((rows) => {
      if (active) setStories(rows.map(mapApiStory))
    })
    return () => {
      active = false
    }
  }, [])

  const initials = MOCKUP_DATA ? "D" : memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "·"
  const view = useMemo(() => buildTodayView({ recommended, recentPlays, now }), [recommended, recentPlays, now])

  /* --- the day and the song of the day --- */
  const sample = useMemo(() => (MOCKUP_DATA ? fixtureDay("date", 3) : null), [])
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
      made.push({ id: "today", label: "Songs for today", tone: "orange", cover: todayRows[0].number, caption: todayRows.map((r) => r.title).join(", "), browseId: "today", numbers: todayRows.map((r) => r.number) })
    }
    const tones = ["sage", "gold", "forest", "sage"] as const
    ;["morning", "evening", "festival", "meditation"].forEach((id, i) => {
      const count = songNumbersForCategory(id).length
      const label = songCategories.find((c) => c.id === id)?.label
      if (count > 0 && label) made.push({ id, label: `${label} songs`, tone: tones[i], cover: songNumbersForCategory(id)[0] ?? i, caption: `${count} songs`, browseId: id, numbers: [] })
    })
    return made
  }, [todayRows])

  const downloadedRows: HomeRowData[] = useMemo(() => {
    const numbers = MOCKUP_DATA ? [...HOME_DOWNLOADED_NUMBERS] : Array.from(new Set(Object.values(offlineFiles).map((f) => f.songNumber)))
    return numbers.map((n) => {
      if (MOCKUP_DATA) return homeSong(n)
      const entry = catalog.byNumber.get(n)
      return { number: n, title: entry?.title ?? `Prabhat Samgiita ${n}`, sub: songSub(n, entry?.durationSeconds ? formatClock(entry.durationSeconds) : null) }
    })
  }, [offlineFiles, catalog.byNumber])

  const storyCards: (StripCardData & { slug: string })[] = useMemo(() => {
    if (MOCKUP_DATA) return HOME_STORIES.map((st) => ({ id: st.slug, slug: st.slug, label: st.eyebrow, tone: "sage" as const, cover: st.cover, title: st.title, caption: st.blurb }))
    return stories.slice(0, 6).map((st, i) => ({ id: st.slug, slug: st.slug, label: "Story", tone: "sage" as const, cover: i + 1, title: st.title, caption: st.teaser }))
  }, [stories])
  const storyOfWeek = useMemo(() => storyOfTheWeek(stories, now), [stories, now])
  void storyOfWeek

  const learnCards: (StripCardData & { target: string })[] = useMemo(
    () =>
      HOME_LEARN.map((c) => ({
        id: c.id,
        label: c.title,
        tone: c.tone,
        cover: c.cover,
        caption: MOCKUP_DATA ? c.caption : c.id === "words" ? "Repeat the words you are learning" : c.id === "quiz" ? "A few questions on the songs" : c.caption,
        target: c.target,
      })),
    [],
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
    () => MIX_FIXTURES.map((m) => ({ id: m.id, label: m.title, tone: m.tone, cover: m.cover, caption: `${mixCaption(m.items)}. ${m.blurb}` })),
    [],
  )
  const kiirtanToday = useMemo(() => {
    const first = kiirtanOfTheDay(kirtans, dayNumberOf(now.getTime()))
    if (!first) return []
    const rest = kirtans.filter((k) => k.id !== first.id).slice(0, 2)
    return [first, ...rest]
  }, [kirtans, now])
  const playMixCard = (id: string) => {
    const mix = MIX_FIXTURES.find((m) => m.id === id)
    if (mix) kActions.flash(playMix(mix) ?? `Playing ${mix.title}`)
  }
  const onKirtanShare = async (k: Kirtan, target: ShareTargetId) => {
    const message = shareToast(await runShare(target, kirtanSharePayload(k)))
    if (message) kActions.flash(message)
  }

  /* --- scroll-linked header: row 1 scrolls away, the chips row sticks, its hairline fades in --- */
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  // The peach wash sits behind row 1 only, so it ends above the sticky chips row (no band under it) and fades as you scroll.
  const washStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, TOP_ROW], [1, 0], Extrapolation.CLAMP) }))
  const chipColors = chipColorsOf(p)

  const shelves = shelvesFor(filter)
  const has: Record<HomeShelfId, boolean> = {
    today: Boolean(hero),
    start: startRows.length > 0,
    kmixes: true,
    kiirtan: kiirtanToday.length > 0,
    mixes: mixes.length > 0,
    because: MOCKUP_DATA,
    trending: MOCKUP_DATA,
    stories: storyCards.length > 0,
    learn: true,
    downloaded: true,
  }
  const visible = shelves.filter((id) => has[id])
  let reveal = 1
  const next = () => Math.min(reveal++, 8)

  const section = (id: HomeShelfId): ReactNodeOrNull => {
    switch (id) {
      case "today":
        return hero ? (
          <Reveal key={id} index={next()}>
            <HomeTodayCard
              p={p}
              dateLabel={day.dateLabel}
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
            <HomeSectionHead p={p} eyebrow="Jump back in" first="Start" second="listening" />
            <HomePagedRows p={p} rows={startRows} onOpen={openSong} onMore={(row) => setMenu({ number: row.number, title: row.title })} />
          </Reveal>
        )
      case "kmixes":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead
              p={p}
              eyebrow="Songs and kiirtans in one order"
              first="Mixes"
              second="for you"
              action={{ label: "Shuffle everything", onPress: () => kActions.flash(playEverything() ?? "Shuffling everything") }}
            />
            <HomeShelf itemWidth={MIX_WIDTH}>
              {mixCards.map((card) => (
                <StripCard key={card.id} p={p} card={card} width={MIX_WIDTH} height={170} onPress={() => playMixCard(card.id)} />
              ))}
            </HomeShelf>
          </Reveal>
        )
      case "kiirtan":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow="Sung together, played in the same player" first="Kiirtan" second="for today" />
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
            <HomeSectionHead p={p} eyebrow="A session based on your taste" first="To get you" second="started" />
            <HomeShelf itemWidth={MIX_WIDTH}>
              {mixes.map((mix) => (
                <StripCard key={mix.id} p={p} card={mix} width={MIX_WIDTH} onPress={() => openMix(mix)} />
              ))}
            </HomeShelf>
          </Reveal>
        )
      case "because":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow="Songs that sit close to it" first="Because you" second={`listened to PS ${HOME_BECAUSE_OF}`} />
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
            <HomeSectionHead p={p} eyebrow="What others are singing" first="Rising" second="this week" />
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
            <HomeSectionHead p={p} eyebrow="Read between songs" first="Stories" second="behind the songs" />
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
            <HomeSectionHead p={p} eyebrow="Practise what you sing" first="Learn" second="something new" />
            <HomeShelf itemWidth={MIX_WIDTH}>
              {learnCards.map((card) => (
                <StripCard key={card.id} p={p} card={card} width={MIX_WIDTH} height={170} onPress={() => router.push(href(card.target))} />
              ))}
            </HomeShelf>
          </Reveal>
        )
      case "downloaded":
        return (
          <Reveal key={id} index={next()} style={styles.section}>
            <HomeSectionHead p={p} eyebrow="Play without a connection" first="Downloaded" second="songs" />
            {downloadedRows.length ? (
              <View style={styles.list}>
                {downloadedRows.map((row) => (
                  <HomeRow key={row.number} p={p} row={row} onOpen={() => openSong(row)} onMore={() => setMenu({ number: row.number, title: row.title })} />
                ))}
              </View>
            ) : (
              <HomeEmpty p={p} text="Nothing is downloaded yet. Open a song and choose Download to keep it for offline." />
            )}
          </Reveal>
        )
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: p.sand200 }]}>
      <Animated.View pointerEvents="none" style={[styles.wash, { height: top + TOP_ROW }, washStyle]}>
        <LinearGradient colors={p.dark ? ["rgba(74, 46, 28, 0.6)", "rgba(74, 46, 28, 0)"] : [p.orange100, "rgba(255, 220, 197, 0)"]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {/* The scroll area starts below the status area, so nothing scrolls under it and the sticky row needs no cap. */}
      <Animated.ScrollView
        style={{ flex: 1, marginTop: top }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.content}
      >
        <HomeTopRow
          p={p}
          initial={initials}
          unread={unread > 0}
          onAvatar={() => router.push(href("/profile-sheet"))}
          onBell={() => router.push(href("/notifications"))}
          onSearch={() => router.push(href("/search-v2?focus=1"))}
        />
        <StickyChipsRow items={HOME_FILTERS} value={filter} onChange={setFilter} colors={chipColors} scrollY={scrollY} stickAt={TOP_ROW} />

        <View style={styles.shelves}>
          {visible.map((id) => section(id))}
          {visible.length === 0 ? <HomeEmpty p={p} text="Nothing here yet." /> : null}
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
        onReport={kActions.report}
        onClose={() => setKMenu(null)}
      />
      <Toast message={kActions.toast ?? actions.toast} theme={songsTheme} />
    </View>
  )
}

type ReactNodeOrNull = React.ReactNode

const styles = StyleSheet.create({
  root: { flex: 1 },
  wash: { position: "absolute", left: 0, right: 0, top: 0 },
  content: { paddingBottom: 200 },
  shelves: { paddingTop: 12, gap: SECTION_GAP },
  section: { gap: 16 },
  list: { paddingHorizontal: HOME_INSET, gap: 8 },
})
