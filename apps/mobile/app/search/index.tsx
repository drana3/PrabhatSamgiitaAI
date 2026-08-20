import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { Clock, X } from "lucide-react-native"
import { planSearch, queryGuidanceFor, queryIsUseful, SEARCH_PLACEHOLDER } from "@prabhat/core"

import { SearchBar } from "@/components/common/SearchBar"
import { FeelingSearchSwitch } from "@/components/search/FeelingSearchSwitch"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { collectionCount } from "@/data/collections"
import { popularSearches, type MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import {
  CATEGORY_RESULT_LIMIT,
  categoryLabel,
  composeBrowseResults,
  collectionFromQuery,
  browseResultsHeading,
  isMoodCategoryId,
  isSongCategoryId,
  limitSearchResults,
  loadCategorySongs,
  mergeSongs,
  rememberCategorySongs,
  resolveCategoryQuery,
  seedCategoryForQuery,
  queryMatchesBrowseCategory,
  semanticQueryForCategory,
} from "@/lib/categorySongs"
import { searchDebounceMs } from "@/lib/searchMode"
import { searchCatalogLyrics, catalogSongsByNumbers, warmLyricSearchIndex } from "@/lib/lyricSearch"
import { songSummaryToMockSong } from "@/lib/songMap"
import { useVoiceSearch } from "@/lib/useVoiceSearch"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

function lyricHitsToSongs(queryHits: ReturnType<typeof searchCatalogLyrics>): MockSong[] {
  return queryHits.map((hit, index) =>
    songSummaryToMockSong(
      {
        number: hit.number,
        title: hit.firstLine || hit.title,
        first_line: hit.snippet || hit.firstLine || hit.title,
        is_verified: true,
      },
      index,
    ),
  )
}


function shouldRunSearch(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= 2 && queryIsUseful(trimmed, 200)
}

export default function SearchScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    q?: string
    category?: string
    listen?: string
    focus?: string
  }>()
  const initialCategory =
    typeof params.category === "string" && isSongCategoryId(params.category)
      ? params.category
      : typeof params.q === "string"
        ? resolveCategoryQuery(params.q)
        : null
  const initial =
    typeof params.q === "string"
      ? params.q
      : initialCategory
        ? categoryLabel(initialCategory)
        : ""
  const [query, setQuery] = useState(initial)
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory)
  const recents = usePreferencesStore((s) => s.searchRecents)
  const addSearchRecent = usePreferencesStore((s) => s.addSearchRecent)
  const clearSearchRecents = usePreferencesStore((s) => s.clearSearchRecents)
  const feelingSearchEnabled = usePreferencesStore((s) => s.feelingSearchEnabled)
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const searchAuth = useMemo(
    () => ({ signedIn, feelingSearchEnabled: signedIn && feelingSearchEnabled }),
    [signedIn, feelingSearchEnabled],
  )
  const [results, setResults] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(() => Boolean(initialCategory) || shouldRunSearch(initial))
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<TextInput>(null)
  const skipQueryDebounceRef = useRef(false)
  const runSearchRef = useRef<(nextQuery: string) => Promise<void>>(async () => {})

  useEffect(() => {
    warmLyricSearchIndex()
  }, [])

  const browseTheme = useCallback(
    async (searchId: string, spokenQuery: string, token: number) => {
      const result = await loadCategorySongs(searchId)
      if (token !== requestId.current) return
      const curated = composeBrowseResults(searchId, result.songs)
      if (curated.length) setResults(curated)
      addSearchRecent(spokenQuery || result.label)

      let extra: MockSong[] = []
      let reachedSearch = false
      const moodChip = isMoodCategoryId(searchId)

      const needsTitles = curated.some(
        (song) => !song.title || /^song\s+\d+$/i.test(song.title) || song.title === String(song.number),
      )
      if (needsTitles) {
        extra = lyricHitsToSongs(
          catalogSongsByNumbers(
            curated.map((song) => song.number),
            Math.max(curated.length, CATEGORY_RESULT_LIMIT),
          ),
        )
        if (token !== requestId.current) return
        const filled = composeBrowseResults(searchId, curated, extra)
        if (filled.length) setResults(filled)
      }

      if (
        moodChip &&
        searchAuth.feelingSearchEnabled &&
        composeBrowseResults(searchId, curated, extra).length < CATEGORY_RESULT_LIMIT
      ) {
        const semanticQueries = [
          spokenQuery.trim(),
          semanticQueryForCategory(searchId, spokenQuery),
          result.label,
        ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index)

        for (const nextQuery of semanticQueries) {
          try {
            const rows = await api.searchSongs(nextQuery, { mode: "semantic" })
            reachedSearch = true
            if (!rows.length) continue
            extra = mergeSongs(
              extra,
              limitSearchResults(
                rows.map((row, index) => songSummaryToMockSong(row, index)),
                "semantic",
              ),
            )
            break
          } catch {
            /* try the next semantic phrasing */
          }
        }
      }

      if (token !== requestId.current) return
      const merged = composeBrowseResults(searchId, curated, extra)
      setResults(merged)
      if (merged.length) {
        rememberCategorySongs(searchId, merged)
        setError(null)
        return
      }
      setError(
        reachedSearch
          ? null
          : "Could not reach search. Try again to search all 5,018 songs.",
      )
    },
    [addSearchRecent, searchAuth.feelingSearchEnabled],
  )

  const runAllCatalogSearch = useCallback(async () => {
    const nextQuery = activeCategory
      ? semanticQueryForCategory(activeCategory, query)
      : query.trim()
    if (!nextQuery) return
    const token = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const localHits = searchCatalogLyrics(nextQuery, CATEGORY_RESULT_LIMIT, { interpret: true })
      if (localHits.length) {
        const mapped = lyricHitsToSongs(localHits)
        setResults(mapped)
        if (activeCategory && mapped.length) rememberCategorySongs(activeCategory, mapped)
        setError(null)
        return
      }
      const rows = await api.searchSongs(nextQuery, { mode: "catalog" })
      if (token !== requestId.current) return
      const mapped = rows.map((row, index) => songSummaryToMockSong(row, index))
      setResults(mapped)
      if (activeCategory && mapped.length) rememberCategorySongs(activeCategory, mapped)
      if (!mapped.length) setError(null)
    } catch (err) {
      if (token !== requestId.current) return
      setError(err instanceof Error ? err.message : "Search is temporarily unavailable.")
    } finally {
      if (token === requestId.current) setLoading(false)
    }
  }, [activeCategory, query])

  const submitVoice = useCallback(async (transcript: string) => {
    const trimmed = transcript.trim()
    if (!trimmed) return
    setError(null)
    try {
      await runSearchRef.current(trimmed)
    } catch {
      /* runSearch already surfaces errors */
    }
    void api
      .searchSongsByVoice(trimmed)
      .then((result) => {
        const extra = result.matches.map((match, index) => songSummaryToMockSong(match.song, index))
        setResults((prev) =>
          activeCategory
            ? composeBrowseResults(activeCategory, prev, extra)
            : mergeSongs(prev, extra),
        )
      })
      .catch(() => {
        // Keep on-screen results. Do not surface "voice search unavailable".
      })
  }, [activeCategory])

  const voice = useVoiceSearch({
    onPartial: (text) => setQuery(text),
    onFinal: (text) => {
      skipQueryDebounceRef.current = true
      setQuery(text)
      void submitVoice(text)
    },
    onUnavailable: () => inputRef.current?.focus(),
  })
  const { listening, error: voiceError, setError: setVoiceError, start, stop, toggle } = voice

  useEffect(() => {
    if (typeof params.q !== "string") return
    const nextQuery = params.q
    skipQueryDebounceRef.current = true
    setActiveCategory(resolveCategoryQuery(nextQuery))
    setQuery(nextQuery)
    if (shouldRunSearch(nextQuery)) {
      setError(null)
      void runSearchRef.current(nextQuery)
    }
  }, [params.q])

  useEffect(() => {
    const categoryId =
      typeof params.category === "string" && isSongCategoryId(params.category)
        ? params.category
        : null
    if (!categoryId) return

    const label = categoryLabel(categoryId)
    setActiveCategory(categoryId)
    setQuery(label)
    setResults([])
    setError(null)
    setLoading(true)

    let active = true
    const token = ++requestId.current
    void (async () => {
      try {
        await browseTheme(categoryId, label, token)
      } finally {
        if (active && token === requestId.current) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [params.category, addSearchRecent, browseTheme])

  useFocusEffect(
    useCallback(() => {
      if (params.listen !== "1") return
      const handle = setTimeout(() => {
        void start()
      }, 180)
      return () => {
        clearTimeout(handle)
        stop()
      }
    }, [params.listen, start, stop]),
  )

  useEffect(() => {
    if (params.focus !== "1") return
    const handle = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(handle)
  }, [params.focus])

  const runSearch = useCallback(async (nextQuery: string) => {
    const trimmed = nextQuery.trim()
    if (trimmed.length < 2) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    if (!queryIsUseful(trimmed, 200)) {
      setResults([])
      setError(queryGuidanceFor(trimmed))
      setLoading(false)
      return
    }

    const chipId = resolveCategoryQuery(trimmed)
    const seedId = seedCategoryForQuery(trimmed)
    if (chipId) setActiveCategory(chipId)
    else setActiveCategory(null)

    const liveAuth = {
      signedIn,
      feelingSearchEnabled:
        signedIn && usePreferencesStore.getState().feelingSearchEnabled,
    }
    const plan = planSearch(trimmed, liveAuth)

    if (seedId && plan.layer !== "mood" && plan.layer !== "semantic") {
      const id = ++requestId.current
      setLoading(true)
      setError(null)
      try {
        await browseTheme(seedId, trimmed, id)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
      return
    }

    const id = ++requestId.current
    searchAbortRef.current?.abort()
    const abort = new AbortController()
    searchAbortRef.current = abort

    if (plan.layer === "mood" && plan.moodId) {
      setLoading(true)
      setError(null)
      try {
        await browseTheme(plan.moodId, trimmed, id)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
      return
    }

    if (plan.layer === "collection") {
      const collection = collectionFromQuery(trimmed)
      if (collection?.songNumbers.length) {
        setResults(
          lyricHitsToSongs(
            catalogSongsByNumbers(collection.songNumbers, collection.songNumbers.length),
          ),
        )
        setError(null)
        setLoading(false)
        addSearchRecent(trimmed)
        return
      }
    }

    if (plan.layer !== "semantic") {
      const localHits = searchCatalogLyrics(trimmed, 5, { interpret: true })
      if (localHits.length) {
        setResults(lyricHitsToSongs(localHits))
        setError(null)
        setLoading(false)
        addSearchRecent(trimmed)
        return
      }
      if (!chipId) setResults([])
      setError(null)
      setLoading(false)
      addSearchRecent(trimmed)
      return
    }

    if (!chipId) setResults([])
    setLoading(true)
    setError(null)

    try {
      const rows = await api.searchSongs(trimmed, { mode: "semantic", signal: abort.signal })
      if (id !== requestId.current) return
      const mapped = rows.map((row, index) => songSummaryToMockSong(row, index))
      setResults(limitSearchResults(mapped, "semantic"))
      addSearchRecent(trimmed)
      setError(null)
    } catch (err) {
      if (id !== requestId.current || abort.signal.aborted) return
      setResults([])
      setError(err instanceof Error ? err.message : "Search is temporarily unavailable.")
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [addSearchRecent, browseTheme, signedIn])

  runSearchRef.current = runSearch

  useEffect(() => {
    if (skipQueryDebounceRef.current) {
      skipQueryDebounceRef.current = false
      return
    }
    if (activeCategory && queryMatchesBrowseCategory(query, activeCategory)) {
      return
    }
    if (activeCategory) setActiveCategory(null)

    const handle = setTimeout(() => {
      void runSearch(query)
    }, searchDebounceMs(query, searchAuth))
    return () => clearTimeout(handle)
  }, [query, runSearch, activeCategory])

  const showResults = Boolean(activeCategory) || query.trim().length >= 2
  const resultsTitle = browseResultsHeading(query, results.length, activeCategory)

  return (
    <ScreenContainer edges={["top", "bottom"]} padded={false} title="Explore">
      <View style={styles.searchWrap}>
        <SearchBar
          editable
          autoFocus={params.focus === "1"}
          showSparkle={false}
          showMic
          inputRef={inputRef}
          voiceListening={listening}
          placeholder={SEARCH_PLACEHOLDER}
          value={query}
          onChangeText={(text) => {
            setVoiceError(null)
            if (activeCategory) setActiveCategory(null)
            setQuery(text)
          }}
          onClear={() => {
            stop()
            setActiveCategory(null)
            setQuery("")
            setResults([])
            setError(null)
          }}
          onMicPress={() => void toggle()}
          onSubmitEditing={() => void runSearch(query)}
        />
        {voiceError ? <Text style={styles.errorInline}>{voiceError}</Text> : null}
        <FeelingSearchSwitch />
      </View>

      {showResults ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              <View style={styles.resultHeader}>
                <Text style={styles.section}>{resultsTitle}</Text>
                {loading && results.length === 0 && !collectionFromQuery(query) ? (
                  <ActivityIndicator color={colors.primary} />
                ) : null}
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {!loading && results.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Text style={styles.empty}>No songs matched “{query.trim()}” yet.</Text>
                  {!searchAuth.feelingSearchEnabled ? (
                    <View style={styles.feelingHint}>
                      <Text style={styles.feelingHintTitle}>Try Feeling search</Text>
                      <Text style={styles.feelingHintBody}>
                        {signedIn
                          ? "Turn on Feeling search to look for meaning and mood across all 5,018 songs."
                          : "Sign in to unlock Feeling search — meaning and mood search across all 5,018 songs."}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          signedIn ? "Turn on Feeling search" : "Sign in for Feeling search"
                        }
                        onPress={() => {
                          if (!signedIn) {
                            router.push(href("/signin"))
                            return
                          }
                          usePreferencesStore.getState().setFeelingSearchEnabled(true)
                          void runSearch(query.trim())
                        }}
                        style={({ pressed }) => [styles.allCatalogButton, pressed && styles.chipPressed]}
                      >
                        <Text style={styles.allCatalogText}>
                          {signedIn ? "Turn on Feeling search" : "Sign in for Feeling search"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Search all 5018 Prabhat Samgiita songs"
                    onPress={() => void runAllCatalogSearch()}
                    style={({ pressed }) => [styles.allCatalogButton, pressed && styles.chipPressed]}
                  >
                    <Text style={styles.allCatalogText}>Search all 5,018 songs</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <CompactSongRow
              song={item}
              lyricLine={item.lyrics || item.originalTitle}
              onPress={() => {
                // Search is presented as a modal; a card song screen can open
                // underneath it. Dismiss first so the main player is visible.
                if (router.canDismiss()) router.dismiss()
                router.push(href(`/song/${item.id}`))
              }}
            />
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.recentHeader}>
            <Text style={styles.section}>Recent searches</Text>
            {recents.length ? (
              <Pressable onPress={clearSearchRecents} accessibilityRole="button">
                <Text style={styles.clearRecents}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {recents.length === 0 ? (
            <Text style={styles.empty}>Searches you run will appear here.</Text>
          ) : null}
          {recents.map((item) => (
            <Pressable
              key={item}
              style={styles.recentRow}
              onPress={() => setQuery(item)}
              accessibilityRole="button"
              accessibilityLabel={`Search ${item}`}
            >
              <Clock size={16} color={colors.textMuted} />
              <Text style={styles.recentText}>{item}</Text>
              <Pressable
                accessibilityLabel={`Remove ${item}`}
                onPress={() =>
                  usePreferencesStore.setState({
                    searchRecents: recents.filter((value) => value !== item),
                  })
                }
              >
                <X size={16} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          ))}

          <Text style={[styles.section, { marginTop: spacing.xl }]}>Popular searches</Text>
          <View style={styles.chips}>
            {popularSearches.map((item) => (
              <Pressable
                key={item}
                onPress={() => setQuery(item)}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.collectionsLink} onPress={() => router.push(href("/collections"))}>
            <Text style={styles.collectionsText}>
              Browse all {collectionCount} special collections →
            </Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.xs },
  errorInline: { ...typography.caption, color: colors.error },
  emptyState: { paddingHorizontal: spacing.lg },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  clearRecents: { ...typography.caption, color: colors.primaryDark },
  section: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.md },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  error: { ...typography.bodySmall, color: colors.error, marginBottom: spacing.sm },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  recentText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { ...typography.caption, color: colors.textPrimary },
  collectionsLink: { marginTop: spacing.xxl, paddingVertical: spacing.md },
  collectionsText: { ...typography.label, color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section },
  empty: { ...typography.bodySmall, color: colors.textSecondary },
  emptyBlock: { gap: spacing.md },
  feelingHint: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  feelingHintTitle: { ...typography.label, color: colors.textPrimary },
  feelingHintBody: { ...typography.bodySmall, color: colors.textSecondary },
  allCatalogButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  allCatalogText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  chipPressed: { opacity: 0.85 },
})
