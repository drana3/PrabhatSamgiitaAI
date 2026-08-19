import { useCallback, useEffect, useRef, useState } from "react"
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
import { queryGuidanceFor, queryIsUseful } from "@prabhat/core"

import { SearchBar } from "@/components/common/SearchBar"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { collectionCount } from "@/data/collections"
import { popularSearches, type MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import {
  categoryLabel,
  isSongCategoryId,
  loadCategorySongs,
  resolveCategoryQuery,
} from "@/lib/categorySongs"
import { resolveSearchMode } from "@/lib/searchMode"
import { songSummaryToMockSong } from "@/lib/songMap"
import { useVoiceSearch } from "@/lib/useVoiceSearch"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

const DEBOUNCE_MS = 280
const SEARCH_CACHE_LIMIT = 40

type SearchCacheEntry = { songs: MockSong[]; at: number }
const searchCache = new Map<string, SearchCacheEntry>()

function cacheKey(query: string, mode: "catalog" | "semantic") {
  return `${mode}:${query.trim().toLowerCase()}`
}

function readSearchCache(query: string, mode: "catalog" | "semantic") {
  return searchCache.get(cacheKey(query, mode))?.songs ?? null
}

function writeSearchCache(query: string, mode: "catalog" | "semantic", songs: MockSong[]) {
  searchCache.set(cacheKey(query, mode), { songs, at: Date.now() })
  if (searchCache.size <= SEARCH_CACHE_LIMIT) return
  const oldest = [...searchCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
  if (oldest) searchCache.delete(oldest[0])
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
  const [results, setResults] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(() => Boolean(initialCategory) || shouldRunSearch(initial))
  const [error, setError] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const requestId = useRef(0)
  const inputRef = useRef<TextInput>(null)

  const submitVoice = useCallback(
    async (transcript: string) => {
      const trimmed = transcript.trim()
      if (!trimmed) return
      setVoiceBusy(true)
      setError(null)
      try {
        const result = await api.searchSongsByVoice(trimmed)
        setQuery(result.interpreted_as || result.heard || trimmed)
        setResults(result.matches.map((match, index) => songSummaryToMockSong(match.song, index)))
        setVoiceNote(
          result.guidance ||
            `Heard “${result.heard}” · interpreted as “${result.interpreted_as}” (${result.confidence})`,
        )
        setError(null)
        addSearchRecent(result.interpreted_as || trimmed)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice search is temporarily unavailable.")
      } finally {
        setVoiceBusy(false)
      }
    },
    [addSearchRecent],
  )

  const voice = useVoiceSearch({
    onPartial: (text) => setQuery(text),
    onFinal: (text) => {
      setQuery(text)
      void submitVoice(text)
    },
    onUnavailable: () => inputRef.current?.focus(),
  })
  const { listening, error: voiceError, setError: setVoiceError, start, stop, toggle } = voice

  useEffect(() => {
    if (typeof params.q !== "string") return
    setActiveCategory(null)
    setQuery(params.q)
    if (shouldRunSearch(params.q)) {
      setResults([])
      setError(null)
      setLoading(true)
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
    setVoiceNote(null)

    let active = true
    void (async () => {
      const result = await loadCategorySongs(categoryId)
      if (!active) return
      setResults(result.songs)
      setLoading(false)
      setError(
        result.songs.length
          ? null
          : "No curated songs for this category yet. Try a word search above.",
      )
      addSearchRecent(result.label)
    })()

    return () => {
      active = false
    }
  }, [params.category, addSearchRecent])

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

    const categoryId = resolveCategoryQuery(trimmed)
    if (categoryId) {
      const id = ++requestId.current
      setActiveCategory(categoryId)
      setLoading(true)
      setError(null)
      try {
        const result = await loadCategorySongs(categoryId)
        if (id !== requestId.current) return
        setResults(result.songs)
        writeSearchCache(trimmed, "catalog", result.songs)
        addSearchRecent(trimmed)
        setError(
          result.songs.length
            ? null
            : "No curated songs for this theme yet. Try a more specific search.",
        )
      } finally {
        if (id === requestId.current) setLoading(false)
      }
      return
    }

    const mode = resolveSearchMode(trimmed)
    const cached = readSearchCache(trimmed, mode)
    if (cached) {
      setResults(cached)
      setLoading(false)
      setError(null)
      addSearchRecent(trimmed)
      return
    }

    const id = ++requestId.current
    // Clear immediately so a previous query's songs are never shown as if they match.
    setResults([])
    setLoading(true)
    setError(null)
    try {
      // Feeling/meaning asks must wait for semantic results only — catalog lexical
      // hits are often wrong for mood queries and must not be shown as a preview.
      const rows = await api.searchSongs(trimmed, { mode })
      if (id !== requestId.current) return
      const mapped = rows.map((row, index) => songSummaryToMockSong(row, index))
      writeSearchCache(trimmed, mode, mapped)
      setResults(mapped)
      addSearchRecent(trimmed)
    } catch (err) {
      if (id !== requestId.current) return
      setResults([])
      setError(err instanceof Error ? err.message : "Search is temporarily unavailable.")
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [addSearchRecent])

  useEffect(() => {
    if (activeCategory && query.trim().toLowerCase() === categoryLabel(activeCategory).toLowerCase()) {
      return
    }
    if (activeCategory) setActiveCategory(null)

    const handle = setTimeout(() => {
      void runSearch(query)
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query, runSearch, activeCategory])

  const isCollectionQuery = query.toLowerCase().includes("search prabhat samgiita for")
  const showResults = Boolean(activeCategory) || query.trim().length >= 2
  const resultsTitle = loading
    ? activeCategory
      ? "Loading category…"
      : "Searching…"
    : activeCategory
      ? `${categoryLabel(activeCategory)} · ${results.length}`
      : isCollectionQuery
        ? "Collection results"
        : "Songs"
  const voiceStatus = listening
    ? "Listening… speak a song number or theme."
    : voiceBusy
      ? "Interpreting through the catalog…"
      : voiceError

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
          placeholder="Search songs, lyrics, themes..."
          value={query}
          onChangeText={(text) => {
            setVoiceNote(null)
            setVoiceError(null)
            if (activeCategory) setActiveCategory(null)
            setQuery(text)
          }}
          onClear={() => {
            stop()
            setActiveCategory(null)
            setQuery("")
            setVoiceNote(null)
            setResults([])
            setError(null)
          }}
          onMicPress={() => void toggle()}
          onSubmitEditing={() => void runSearch(query)}
        />
        {voiceStatus ? <Text style={styles.voiceStatus}>{voiceStatus}</Text> : null}
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
                {loading ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
              {loading ? (
                <Text style={styles.searching}>
                  {activeCategory
                    ? "Opening curated songs from your catalog cache…"
                    : resolveSearchMode(query) === "semantic"
                      ? "Matching feelings and meanings across the catalog…"
                      : "Searching the catalog…"}
                </Text>
              ) : null}
              {voiceNote ? <Text style={styles.hint}>{voiceNote}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {!loading && !error && results.length === 0 ? (
                <Text style={styles.empty}>No songs matched “{query.trim()}”.</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <CompactSongRow
              song={item}
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
  voiceStatus: { ...typography.caption, color: colors.textMuted },
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
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  searching: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
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
})
