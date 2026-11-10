import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { queryIsUseful, type SongSummary } from "@prabhat/core"

import {
  AnswerCard,
  CollectionChips,
  DetectLabel,
  ResultList,
} from "@/components/search-v2/SearchBlocks"
import { SearchHeader } from "@/components/search-v2/BrowseBlocks"
import { ChordGroups, ChordsBar, ChordsNote } from "@/components/search-v2/ChordsParts"
import { FiltersButton, FiltersPanel } from "@/components/search-v2/FiltersParts"
import { NothingFound } from "@/components/search-v2/NothingFound"
import { SearchCards } from "@/components/search-v2/SearchCards"
import { AuthorsSearchBlock } from "@/components/authors/AuthorsSearchBlock"
import { StoryResults } from "@/components/search-v2/StoryResults"
import { ArtistChip } from "@/components/kirtan/ArtistParts"
import { KirtanRow } from "@/components/kirtan/KirtanParts"
import { FloatingTabBar } from "@/components/nav-v2/FloatingTabBar"
import { chipColorsOf, StickyChipsRow } from "@/components/nav-v2/StickyChips"
import { Toast } from "@/components/songs-v2/Toast"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useKirtans } from "@/hooks/useKirtans"
import { useSearchCardsData } from "@/hooks/useSearchCardsData"
import { useSearchMenu } from "@/hooks/useSearchMenu"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsWithChords } from "@/hooks/useSongsWithChords"
import { sampleArtists } from "@/lib/fixtures/kirtanGate"
import { SEARCH_SCOPES, parseSearchScope, scopeShows, searchArtists, searchKirtans, type SearchScope } from "@/lib/kirtan/search"
import { NAV_V2_HOME_ROUTE, NAV_V2_TABS, contentInsetFor, miniPlayerVisible, tabIdForRouteName, type NavV2TabId } from "@/lib/navV2"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { usePlayerStore } from "@/stores/playerStore"
import { useSharedValue as useSharedValueRN } from "react-native-reanimated"
import { SearchField } from "@/components/search-v2/SearchField"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { api } from "@/lib/client"
import { flattenResults } from "@/lib/searchProto"
import { MOCK_SONGS_WITH_CHORDS } from "@/lib/fixtures/chordsMock"
import { MOCK_OFFLINE } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { buildSearchCards, type SearchCard } from "@/lib/searchCards/cards"
import { chordsModeAfterQuery, initialChordsMode, splitByChords, toggleChordsMode, type ChordsMode } from "@/lib/searchCards/chordsMode"
import { applyFilters, buildFilterRows, selectedCount, toggleFilter, type FilterSelection } from "@/lib/searchCards/filters"
import { buildSearchBy } from "@/lib/searchMenu/searchBy"
import { shelfItems } from "@/lib/searchMenu/live"
import { warmLyricSearchIndex } from "@/lib/lyricSearch"
import {
  mergeMeaningRows,
  searchLocal,
  type SearchResultItem,
  type UnifiedResult,
} from "@/lib/unifiedSearch"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { wantsChords } from "@/lib/songsV2/chordsFirst"
import { hintLine, outOfRangeMessage, parseSearchParams, withoutRecent } from "@/lib/unifiedSearchQuery"
import { useVoiceSearch } from "@/lib/useVoiceSearch"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

/** Local results are instant; the meaning lookup waits until typing pauses. */
const LOCAL_DEBOUNCE_MS = 40
const MEANING_DEBOUNCE_MS = 450
const MIN_MEANING_CHARS = 3
const FOCUS_DELAY_MS = 120
const LISTEN_DELAY_MS = 180
const IDLE_WARM_MS = 400

type MeaningState = {
  query: string
  rows: SongSummary[]
  pending: boolean
  /** the server only searches by meaning for signed-in members; a guest gets a quiet note instead */
  guest?: boolean
}

/** True when the app can sign a request as a member (signed in, and this build carries the member key). */
function canSearchByMeaning(): boolean {
  return Object.keys(authHeadersFromStore()).length > 0
}

/**
 * Unified search (spec SCR-13). One field takes a number, a name, a line of
 * lyrics or a feeling; there are no modes to choose. Redesign screen, reachable
 * at /search-v2 until Today and Songs point at it. Understands the Today
 * parameters `hint` (number | words | feeling), `q`, `focus` and `listen`.
 */
export default function UnifiedSearchScreen() {
  const t = useT()
  const router = useRouter()
  // opened by a link or a notification there is nothing to go back to: land on Today
  const leave = useCallback(() => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE))), [router])
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const top = insets.top || amProto.statusArea
  const navigation = useNavigation()
  const hasSong = usePlayerStore((st) => Boolean(st.currentSong))
  const authMode = useAuthStore((st) => st.mode)
  // Search is a page of the tab it was opened from: the bar stays under it with that tab marked (none if opened directly).
  const underTab = useMemo<NavV2TabId | null>(() => {
    const state = navigation.getState()
    const below = state?.routes?.[(state.index ?? 0) - 1]
    const nested = below?.state
    const inner = nested?.routes?.[nested.index ?? 0]?.name
    // opened directly (a link, a notification) there is no tab below: the bar marks none
    return tabIdForRouteName(inner ?? below?.name, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const bottomInset = contentInsetFor(insets.bottom, miniPlayerVisible({ pathname: "/search-v2", hasSong }))
  const reduce = useReducedMotion()
  const params = useLocalSearchParams<{ q?: string; hint?: string; focus?: string; listen?: string; scope?: string; menu?: string }>()
  const parsed = useMemo(
    () => parseSearchParams(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.q, params.hint, params.focus, params.listen],
  )

  const initials = useProfileInitial()
  const recents = usePreferencesStore((s) => s.searchRecents)
  const addSearchRecent = usePreferencesStore((s) => s.addSearchRecent)
  const clearSearchRecents = usePreferencesStore((s) => s.clearSearchRecents)
  const recentPlays = usePreferencesStore((s) => s.recentPlays)

  const [scope, setScope] = useState<SearchScope>(parseSearchScope(params.scope))
  const songsTheme = useSongsTheme()
  const kActions = useKirtanActions()
  const { playable: kirtanCatalog } = useKirtans()
  const menu = useSearchMenu(params.menu)
  const chipScroll = useSharedValueRN(0)
  const [query, setQuery] = useState(parsed.query)
  const [selectOnFocus, setSelectOnFocus] = useState(parsed.prefilled)
  const [local, setLocal] = useState<UnifiedResult>(() => searchLocal(parsed.query))
  const [meaning, setMeaning] = useState<MeaningState>({ query: "", rows: [], pending: false })
  const inputRef = useRef<TextInput>(null)
  const skipDebounce = useRef(true)

  // A new q / hint while the screen is open (router.setParams, deep link) replaces the field.
  const firstParams = useRef(true)
  useEffect(() => {
    if (firstParams.current) {
      firstParams.current = false
      return
    }
    skipDebounce.current = true
    setQuery(parsed.query)
    setSelectOnFocus(parsed.prefilled)
    setLocal(searchLocal(parsed.query))
  }, [parsed.query, parsed.prefilled])

  useEffect(() => {
    const idle = setTimeout(warmLyricSearchIndex, IDLE_WARM_MS)
    return () => clearTimeout(idle)
  }, [])

  useEffect(() => {
    if (!parsed.focus) return
    const handle = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS)
    return () => clearTimeout(handle)
  }, [parsed.focus])

  // Local search, on every change.
  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false
      return
    }
    const handle = setTimeout(() => setLocal(searchLocal(query)), LOCAL_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  // Meaning search from the server, streamed in after the local results.
  useEffect(() => {
    const trimmed = local.query
    if (MOCKUP_DATA || !local.wantsMeaning || trimmed.length < MIN_MEANING_CHARS || !queryIsUseful(trimmed, 200)) {
      setMeaning((prev) => (prev.pending || prev.guest ? { ...prev, pending: false, guest: false } : prev))
      return
    }
    if (!canSearchByMeaning()) {
      // The server answers 401 to guests: do not wait for it, say so quietly.
      setMeaning({ query: trimmed, rows: [], pending: false, guest: true })
      return
    }
    const abort = new AbortController()
    const handle = setTimeout(() => {
      setMeaning({ query: trimmed, rows: [], pending: true })
      api
        .searchSongs(trimmed, { mode: "semantic", signal: abort.signal })
        .then((rows: SongSummary[]) => setMeaning({ query: trimmed, rows, pending: false }))
        .catch(() => {
          // Keep the local results. A failed meaning lookup is not something the person can act on.
          if (!abort.signal.aborted) setMeaning({ query: trimmed, rows: [], pending: false })
        })
    }, MEANING_DEBOUNCE_MS)
    return () => {
      clearTimeout(handle)
      abort.abort()
    }
  }, [local.query, local.wantsMeaning])

  // "Songs with chords first": on by itself when the query has a guitar-ish word ("guitar", "chords", "capo", "гитара",
  // "аккорды"), one tap turns it off (lib/searchCards/chordsMode.ts). The songs with chords become their own block on top.
  // In the browser preview the server's list is not read, so a small sample stands in (lib/fixtures/chordsMock.ts).
  const serverChords = useSongsWithChords()
  const songsWithChords = serverChords ?? (MOCKUP_DATA ? MOCK_SONGS_WITH_CHORDS : null)
  const [chords, setChords] = useState<ChordsMode>(() => initialChordsMode(parsed.query))
  const lastQuery = useRef(query)
  useEffect(() => {
    // read the old query now: the updater below runs later, after the ref has moved on
    const before = lastQuery.current
    lastQuery.current = query
    setChords((prev) => chordsModeAfterQuery(prev, before, query))
  }, [query])
  const result = useMemo(() => (meaning.query === local.query ? mergeMeaningRows(local, meaning.rows) : local), [local, meaning])
  const waitingForMeaning = !MOCKUP_DATA && meaning.pending && meaning.query === local.query
  const guestMeaning = !MOCKUP_DATA && Boolean(meaning.guest) && meaning.query === local.query

  const remember = useCallback((value: string) => addSearchRecent(value), [addSearchRecent])

  const setText = useCallback((text: string) => {
    setSelectOnFocus(false)
    setQuery(text)
  }, [])

  const pick = useCallback(
    (text: string) => {
      Keyboard.dismiss()
      skipDebounce.current = true
      setSelectOnFocus(false)
      setQuery(text)
      setLocal(searchLocal(text))
      remember(text)
    },
    [remember],
  )

  const voice = useVoiceSearch({
    onPartial: (text: string) => setText(text),
    onFinal: (text: string) => {
      const transcript = text.trim()
      if (!transcript) return
      skipDebounce.current = true
      setQuery(transcript)
      setLocal(searchLocal(transcript))
      remember(transcript)
      // The server's voice matcher knows spoken Sanskrit spellings better than the local index.
      void api
        .searchSongsByVoice(transcript)
        .then((voiceResult: { matches: Array<{ song: SongSummary }> }) =>
          setMeaning((prev) => ({
            query: transcript,
            rows: [
              ...(prev.query === transcript ? prev.rows : []),
              ...voiceResult.matches.map((match) => match.song),
            ],
            pending: false,
          })),
        )
        .catch(() => undefined)
    },
    onUnavailable: () => inputRef.current?.focus(),
  })
  const { listening, error: voiceError, setError: setVoiceError, start, stop, toggle } = voice

  useFocusEffect(
    useCallback(() => {
      if (!parsed.listen) return
      const handle = setTimeout(() => void start(), LISTEN_DELAY_MS)
      return () => {
        clearTimeout(handle)
        stop()
      }
    }, [parsed.listen, start, stop]),
  )

  const openItem = useCallback(
    (item: SearchResultItem) => {
      remember(query)
      router.push(href(`/song-v2/${item.song.id}`))
    },
    [query, remember, router],
  )

  const offlineFiles = useOfflineAudioStore((state) => state.files)
  const offlineNumbers = useMemo(
    () => (MOCKUP_DATA ? new Set(MOCK_OFFLINE) : new Set(Object.values(offlineFiles).map((entry) => entry.songNumber))),
    [offlineFiles],
  )
  const empty = query.trim().length === 0
  const rows = useMemo(
    // The preview searches the same bundled index as the real build: all 5,018 songs by number, title, first line and words.
    () => flattenResults(result.groups),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` makes the "why it matched" labels follow the language
    [result.groups, t],
  )
  const collections = useMemo(
    () => result.groups.flatMap((group) => group.collections ?? []),
    [result.groups],
  )
  const split = useMemo(() => splitByChords(rows, (row) => Number(row.item.song.number), songsWithChords), [rows, songsWithChords])
  const chordsAsked = wantsChords(query)

  // `.search`: the overlay drops in from 8dp above, 220ms (animation: searchin)
  const drop = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (!reduce) drop.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.22, 1, 0.36, 1) })
  }, [drop, reduce])
  const dropStyle = useAnimatedStyle(() => ({ opacity: drop.value, transform: [{ translateY: (1 - drop.value) * -8 }] }))

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` re-reads the scope labels when the language changes
  const scopeItems = useMemo(() => SEARCH_SCOPES.map((item) => ({ id: item.id, label: item.label })), [t])
  // the five wide cards of the empty page, and the pages behind them: what the app really holds, nothing made up
  const cardsData = useSearchCardsData(menu)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` re-reads the card names when the language changes
  const cards = useMemo(() => buildSearchCards(cardsData.cards, (id) => t(`searchCards.card.${id}` as const)), [cardsData.cards, t])
  const openCard = useCallback((card: SearchCard) => router.push(href(card.target)), [router])
  const askToAdd = useCallback(() => router.push(href(authMode === "guest" ? "/signin" : "/feedback")), [router, authMode])
  // "Filters" (after a query): Style, Instrument, Tempo, Performer narrow the Kiirtans; each is a shelf of the Search menu
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<FilterSelection>({})
  const filterRows = useMemo(
    () => buildFilterRows(buildSearchBy({ stats: menu.stats, psKinds: [], psMoods: [] }), menu.stats.authors),
    // the words follow the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menu.stats, t],
  )
  const filtersOn = selectedCount(filters)
  useEffect(() => {
    if (!query.trim()) {
      setFilters({})
      setFiltersOpen(false)
    }
  }, [query])
  const kirtanMatches = useMemo(() => searchKirtans(kirtanCatalog, query, scope === "all" ? 5 : 50), [kirtanCatalog, query, scope])
  const kirtanHits = useMemo(
    () => (filtersOn ? applyFilters(searchKirtans(kirtanCatalog, query, 200), filters, (id) => new Set(shelfItems(id, menu.kirtans, menu.stats, menu.now).map((k) => k.id))).slice(0, scope === "all" ? 5 : 50) : kirtanMatches),
    [filtersOn, filters, kirtanCatalog, query, scope, kirtanMatches, menu.kirtans, menu.stats, menu.now],
  )
  // TODO(api): artists come from the backend; today they are the preview fixtures.
  const artistHits = useMemo(() => searchArtists(sampleArtists(), kirtanCatalog, query, 6), [kirtanCatalog, query])
  const show = scopeShows(scope)
  // The artist row and the Kiirtans: first when the words are an artist's name, after the songs otherwise.
  const kirtanFirst = scope === "kiirtan" || artistHits.length > 0
  const kirtanSection = !show.kiirtans ? null : (
    <>
      {artistHits.length ? (
        <View style={styles.kirtanList}>
          <Text style={[styles.groupLabel, { color: p.orange700 }]}>{t("search.group.artists")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.artistScroll} contentContainerStyle={styles.artists}>
            {artistHits.map((a) => (
              <ArtistChip key={a.id} artist={a} color={p.ink800} onPress={(id) => { remember(query); kActions.openArtist(id) }} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {kirtanHits.length ? (
        <View style={styles.kirtanList}>
          <Text style={[styles.groupLabel, { color: p.orange700 }]}>{t("search.group.kiirtans")}</Text>
          {kirtanHits.map((k) => (
            <KirtanRow key={k.id} theme={songsTheme} kirtan={k} onOpen={(row) => { remember(query); kActions.open(row, kirtanHits, "Search") }} onOpenArtist={kActions.openArtist} />
          ))}
        </View>
      ) : scope === "kiirtan" ? (
        <Text style={[styles.waitingText, styles.pad, { color: p.ink500, paddingHorizontal: 20 }]}>{t("search.kiirtan.none", { query: query.trim() })}</Text>
      ) : null}
    </>
  )
  const typing = !empty
  const showHint = typing || Boolean(voiceError) || Boolean(parsed.hint)
  const field = (
    <View style={[styles.top, { backgroundColor: p.sand200 }]}>
      <SearchField
        p={p}
        value={query}
        onChangeText={(text: string) => {
          setVoiceError(null)
          setText(text)
        }}
        onSubmit={() => remember(query)}
        onClear={() => {
          stop()
          setText("")
          setLocal(searchLocal(""))
          inputRef.current?.focus()
        }}
        onMic={() => void toggle()}
        listening={listening}
        selectOnFocus={selectOnFocus}
        inputRef={inputRef}
        soft
        placeholder={t("search.placeholder")}
      />
      {typing ? (
        <TodayPress accessibilityRole="button" accessibilityLabel={t("search.close")} onPress={leave} pressedScale={0.94} style={styles.cancel}>
          <Text style={[styles.cancelText, { color: p.ink800 }]}>{t("common.cancel")}</Text>
        </TodayPress>
      ) : null}
    </View>
  )

  return (
    <Animated.View style={[styles.safe, { backgroundColor: p.sand200, paddingTop: top }, dropStyle]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
      >
        {/* The field is always child 1 (the sticky one): moving it would remount it and drop the keyboard after the first letter. */}
        {typing ? (
          <View />
        ) : (
          <SearchHeader
            p={p}
            initial={initials}
            listening={listening}
            onAvatar={() => router.push(href("/profile-sheet"))}
            onMic={() => void toggle()}
            onClose={leave}
          />
        )}
        {field}
        {showHint ? <DetectLabel p={p} text={voiceError ?? hintLine(query, parsed.hint)} /> : null}

        {empty ? (
          <SearchCards p={p} cards={cards} recents={recents} onRecent={pick} onClearRecents={clearSearchRecents} onOpen={openCard} />

        ) : (
          <View style={styles.results}>
            <StickyChipsRow items={scopeItems} value={scope} onChange={setScope} colors={chipColorsOf(p)} scrollY={chipScroll} stickAt={99999} />
            {show.songs ? (
              <View style={styles.chordsBlock}>
                <ChordsBar p={p} theme={songsTheme} on={chords.on} asked={chordsAsked && chords.on} onToggle={() => setChords(toggleChordsMode)} />
                {chords.on && rows.length && songsWithChords === null ? <ChordsNote p={p} text={t("searchCards.chords.unknown")} /> : null}
                {chords.on && rows.length && songsWithChords !== null && split.withChords.length === 0 ? <ChordsNote p={p} text={t("searchCards.chords.none")} /> : null}
              </View>
            ) : null}
            {show.kiirtans && filterRows.length ? (
              <View style={styles.filtersBlock}>
                <FiltersButton p={p} count={filtersOn} open={filtersOpen} onPress={() => setFiltersOpen((open) => !open)} />
                {filtersOpen ? (
                  <FiltersPanel p={p} rows={filterRows} selection={filters} onToggle={(row, shelfId) => setFilters((prev) => toggleFilter(prev, row, shelfId))} onClear={() => setFilters({})} />
                ) : null}
                {filtersOn && kirtanHits.length === 0 ? <ChordsNote p={p} text={t("searchCards.filters.none")} /> : null}
              </View>
            ) : null}
            {kirtanFirst ? kirtanSection : null}
            {show.stories ? (
              <StoryResults p={p} query={query} onOpen={(story) => { remember(query); router.push(href(`/stories/${story.slug}`)) }} onBrowse={() => router.push(href("/stories"))} />
            ) : null}
            {!show.songs ? null : !MOCKUP_DATA && result.answer ? (
              <AnswerCard p={p} answer={result.answer} onOpen={openItem} onAsk={() => router.push(href("/assistant"))} />
            ) : null}
            {show.songs && rows.length ? (
              chords.on && split.withChords.length ? (
                <ChordGroups p={p} split={split} offlineNumbers={offlineNumbers} onOpen={openItem} />
              ) : (
                <ResultList p={p} rows={rows} offlineNumbers={offlineNumbers} onOpen={openItem} />
              )
            ) : null}
            {show.songs && collections.length ? <CollectionChips p={p} names={collections} onPick={pick} /> : null}
            {show.songs && scope === "all" ? <AuthorsSearchBlock theme={songsTheme} query={query} /> : null}
            {kirtanFirst ? null : kirtanSection}
            {show.songs && waitingForMeaning ? (
              <View style={styles.waiting} accessibilityLiveRegion="polite">
                <ActivityIndicator color={p.orange500} />
                <Text style={[styles.waitingText, { color: p.ink500 }]}>{t("search.byMeaning")}</Text>
              </View>
            ) : null}
            {show.songs && guestMeaning ? (
              <Text style={[styles.waitingText, styles.quiet, { color: p.ink500 }]} accessibilityLiveRegion="polite">
                {t("search.guest")}
              </Text>
            ) : null}
            {show.songs && !(scope === "all" && (kirtanHits.length || artistHits.length)) && rows.length === 0 && !waitingForMeaning && (MOCKUP_DATA || !result.answer) ? (
              <NothingFound
                p={p}
                query={query.trim()}
                message={result.message === outOfRangeMessage() ? result.message : null}
                moods={cardsData.moods.songs}
                onTry={pick}
                onMood={(tile) => router.push(href(tile.href))}
                onAllMoods={() => router.push(href("/search-browse?section=mood"))}
                onAsk={askToAdd}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
      <Toast message={kActions.toast} theme={songsTheme} />
      {/* The bar stays under Search, as in Spotify; the mini-player (root layout) sits above it. */}
      <FloatingTabBar
        activeId={underTab}
        onSelect={(id) => {
          Keyboard.dismiss()
          const tab = NAV_V2_TABS.find((t) => t.id === id)
          if (tab) router.dismissTo(href(tab.href))
        }}
        onReselect={leave}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 4, paddingBottom: 8, paddingLeft: 10, paddingRight: 6, zIndex: 5 },
  cancel: { height: 56, paddingHorizontal: 14, justifyContent: "center" },
  cancelText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 18 },
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },
  artistScroll: { marginHorizontal: -16 },
  artists: { paddingHorizontal: 16, gap: 8 },
  quiet: { paddingHorizontal: 20, fontSize: 14 },
  results: { gap: 24 },
  chordsBlock: { gap: 12 },
  filtersBlock: { gap: 12 },
  kirtanList: { gap: 10, paddingHorizontal: 16 },
  groupLabel: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  pad: { paddingHorizontal: 4 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  waitingText: { fontFamily: amFonts.medium, fontSize: 16 },
})
