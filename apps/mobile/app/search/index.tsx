import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Clock, X } from "lucide-react-native"
import { queryGuidanceFor, queryIsUseful } from "@prabhat/core"

import { SearchBar } from "@/components/common/SearchBar"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { VoiceSearchModal } from "@/components/common/VoiceSearchModal"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { popularSearches, type MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { resolveSearchMode } from "@/lib/searchMode"
import { songSummaryToMockSong } from "@/lib/songMap"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

const DEBOUNCE_MS = 350

export default function SearchScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ q?: string; voice?: string }>()
  const initial = typeof params.q === "string" ? params.q : ""
  const [query, setQuery] = useState(initial)
  const recents = usePreferencesStore((s) => s.searchRecents)
  const addSearchRecent = usePreferencesStore((s) => s.addSearchRecent)
  const clearSearchRecents = usePreferencesStore((s) => s.clearSearchRecents)
  const [results, setResults] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(params.voice === "1")
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (typeof params.q === "string") setQuery(params.q)
    if (params.voice === "1") setVoiceOpen(true)
  }, [params.q, params.voice])

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

    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const rows = await api.searchSongs(trimmed, { mode: resolveSearchMode(trimmed) })
      if (id !== requestId.current) return
      setResults(rows.map((row, index) => songSummaryToMockSong(row, index)))
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
    const handle = setTimeout(() => {
      void runSearch(query)
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query, runSearch])

  const openVoice = () => {
    setVoiceError(null)
    setVoiceOpen(true)
  }

  const submitVoice = async (transcript: string) => {
    setVoiceBusy(true)
    setVoiceError(null)
    try {
      const result = await api.searchSongsByVoice(transcript)
      setQuery(result.interpreted_as || result.heard || transcript)
      setResults(result.matches.map((match, index) => songSummaryToMockSong(match.song, index)))
      setVoiceNote(
        result.guidance ||
          `Heard “${result.heard}” · interpreted as “${result.interpreted_as}” (${result.confidence})`,
      )
      setError(null)
      setVoiceOpen(false)
      addSearchRecent(result.interpreted_as || transcript)
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Voice search is temporarily unavailable.")
    } finally {
      setVoiceBusy(false)
    }
  }

  const isCollectionQuery = query.toLowerCase().includes("search prabhat samgiita for")
  const showResults = query.trim().length >= 2

  return (
    <ScreenContainer edges={["top", "bottom"]} padded={false} title="Search">
      <View style={styles.searchWrap}>
        <SearchBar
          editable
          showSparkle={false}
          showMic
          placeholder="Search songs, lyrics, themes..."
          value={query}
          onChangeText={(text) => {
            setVoiceNote(null)
            setQuery(text)
          }}
          onClear={() => {
            setQuery("")
            setVoiceNote(null)
            setResults([])
            setError(null)
          }}
          onMicPress={openVoice}
          onSubmitEditing={() => void runSearch(query)}
        />
      </View>

      {showResults ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              <View style={styles.resultHeader}>
                <Text style={styles.section}>
                  {isCollectionQuery ? "Collection results" : "Songs"}
                </Text>
                {loading ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
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
            <Text style={styles.collectionsText}>Browse all 69 special collections →</Text>
          </Pressable>
        </View>
      )}

      <VoiceSearchModal
        visible={voiceOpen}
        busy={voiceBusy}
        error={voiceError}
        onClose={() => setVoiceOpen(false)}
        onSubmit={(transcript) => void submitVoice(transcript)}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
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
