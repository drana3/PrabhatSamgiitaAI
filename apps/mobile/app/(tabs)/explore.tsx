import { useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ScreenContainer, SectionHeader } from "@/components/screen-shell"
import { SearchField } from "@/components/search-field"
import { SongCard } from "@/components/song-card"
import { api, colors, spacing } from "@/lib/client"
import type { SongSummary } from "@prabhat/core"

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ q?: string }>()
  const [query, setQuery] = useState(typeof params.q === "string" ? params.q : "")
  const [results, setResults] = useState<SongSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runSearch(value = query) {
    const trimmed = value.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      setResults(await api.searchSongs(trimmed))
    } catch (caught) {
      setResults([])
      setError(caught instanceof Error ? caught.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof params.q === "string" && params.q.trim()) {
      void runSearch(params.q)
    }
  }, [params.q])

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <SectionHeader
              eyebrow="Explore"
              title="Find a song"
              subtitle="Search by number, opening line, meaning, or natural language."
            />
            <SearchField value={query} onChangeText={setQuery} onSubmit={() => void runSearch()} />
          </View>

          {loading ? <ActivityIndicator color={colors.gold500} style={{ marginTop: spacing.lg }} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.list}>
            {results.map((song) => (
              <SongCard key={song.number} song={song} />
            ))}
          </View>

          {!loading && !error && results.length === 0 ? (
            <Text style={styles.hint}>Try “song 111”, “Bandhu He”, or “peaceful morning meditation”.</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  header: { padding: spacing.lg, gap: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  error: { paddingHorizontal: spacing.lg, color: "#b45309" },
  hint: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, color: colors.stone600, lineHeight: 22 },
})
