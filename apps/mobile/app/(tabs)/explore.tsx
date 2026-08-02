import { useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native"

import {
  EmptyState,
  QuickChips,
  ScreenSafe,
  SectionHeader,
} from "@/components/screen-shell"
import { SearchField } from "@/components/search-field"
import { SongCard } from "@/components/song-card"
import { api, colors, spacing, typography } from "@/lib/client"
import type { SongSummary } from "@prabhat/core"

const QUICK_SEARCHES = ["Song 1", "Song 111", "Bandhu He", "peaceful morning"]

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ q?: string }>()
  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "")
  const [results, setResults] = useState<SongSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (value = query) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      setResults(await api.searchSongs(trimmed))
    } catch (caught) {
      setResults([])
      setError(caught instanceof Error ? caught.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const initial = typeof params.q === "string" ? params.q.trim() : ""
    if (!initial) return
    setQuery(initial)
    setLoading(true)
    setError(null)
    setSearched(true)
    void api
      .searchSongs(initial)
      .then(setResults)
      .catch((caught) => {
        setResults([])
        setError(caught instanceof Error ? caught.message : "Search failed")
      })
      .finally(() => setLoading(false))
  }, [params.q])

  const listHeader = (
    <View style={styles.header}>
      <SectionHeader
        eyebrow="Explore"
        title="Find a song"
        subtitle="Search by number, opening line, meaning, or natural language."
      />
      <SearchField value={query} onChangeText={setQuery} onSubmit={() => void runSearch()} />
      {!searched ? (
        <QuickChips
          items={QUICK_SEARCHES}
          onSelect={(item) => {
            setQuery(item)
            void runSearch(item)
          }}
        />
      ) : null}
      {loading ? <ActivityIndicator color={colors.gold500} style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && searched && results.length > 0 ? (
        <Text style={styles.resultCount}>
          {results.length} {results.length === 1 ? "song" : "songs"} found
        </Text>
      ) : null}
    </View>
  )

  const listEmpty =
    !loading && searched && !error ? (
      <EmptyState
        icon="musical-notes-outline"
        title="No songs matched"
        copy='Try a song number, opening line like "Bandhu He", or a mood such as "peaceful morning".'
      />
    ) : !searched && !loading ? (
      <EmptyState
        icon="search-outline"
        title="Search the collection"
        copy="Enter a song number, lyric, or theme to get started."
      />
    ) : null

  return (
    <ScreenSafe edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          data={results}
          keyExtractor={(song) => String(song.number)}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <SongCard song={item} />
            </View>
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>
    </ScreenSafe>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  loader: { marginTop: spacing.sm },
  error: { color: "#b45309", lineHeight: 22 },
  resultCount: {
    color: colors.stone600,
    fontSize: typography.caption,
    fontWeight: "600",
  },
})
