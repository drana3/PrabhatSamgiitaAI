import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import { Library } from "lucide-react-native"

import { SearchBar } from "@/components/common/SearchBar"
import { ScreenContainer, SectionHeader } from "@/components/common/ScreenContainer"
import { CategoryGrid } from "@/components/songs/CategoryGrid"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { songCategories, songCollectionChips } from "@/constants/categories"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { collectionCount } from "@/data/collections"
import type { MockSong } from "@/data/mock"
import { CATALOG_PAGE_SIZE, loadCatalog, pageSongs, readCatalogCache } from "@/lib/catalog"
import { prefetchCategorySongs } from "@/lib/categorySongs"
import { songSummaryToMockSong } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

export default function SongsScreen() {
  const router = useRouter()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const [allSongs, setAllSongs] = useState<MockSong[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const result = await loadCatalog()
    setAllSongs(result.songs.map((row, index) => songSummaryToMockSong(row, index)))
    prefetchCategorySongs(result.songs)
    setFromCache(result.fromCache)
    setError(result.error)
    setPage(1)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const cached = await readCatalogCache()
      if (!active) return
      if (cached?.length) {
        setAllSongs(cached.map((row, index) => songSummaryToMockSong(row, index)))
        prefetchCategorySongs(cached)
        setFromCache(true)
        setLoading(false)
      }
      await load()
    })()
    return () => {
      active = false
    }
  }, [load])

  const songs = useMemo(() => pageSongs(allSongs, page), [allSongs, page])
  const hasMore = songs.length < allSongs.length

  return (
    <ScreenContainer padded={false} showGuru={false}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Songs</Text>
          {loading || refreshing ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
        <SearchBar
          placeholder="Search songs, themes, numbers..."
          showSparkle={false}
          showFilter
          showMic
          onPress={() => router.push(href("/search?focus=1"))}
          onMicPress={() => router.push(href("/search?listen=1"))}
          onFilterPress={() => router.push(href("/search?focus=1"))}
        />
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: hasSong ? 160 : 110 }]}
        onEndReached={() => {
          if (hasMore) setPage((current) => current + 1)
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Browse ${collectionCount} collections`}
              onPress={() => router.push(href("/collections"))}
              style={({ pressed }) => [styles.collectionsBanner, pressed && { opacity: 0.94 }]}
            >
              <View style={styles.collectionsIcon}>
                <Library size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.collectionsTitle}>Special collections</Text>
                <Text style={styles.collectionsSub}>
                  All {collectionCount} curated paths — languages, festivals, seasons, ideals
                </Text>
              </View>
            </Pressable>

            <View style={styles.categorySection}>
              <SectionHeader title="Categories" />
              <CategoryGrid
                items={songCategories}
                onSelect={(categoryId) =>
                  router.push(href(`/search?category=${encodeURIComponent(categoryId)}`))
                }
              />
            </View>
            <View style={styles.collectionsSection}>
              <SectionHeader title="Top collections" />
              <CategoryGrid
                items={songCollectionChips}
                onSelect={(categoryId) =>
                  router.push(href(`/search?category=${encodeURIComponent(categoryId)}`))
                }
                onSeeAll={() => router.push(href("/collections"))}
              />
            </View>
            <View style={styles.popularHeader}>
              <SectionHeader
                title={
                  loading
                    ? "Loading catalog…"
                    : allSongs.length
                      ? `From the catalog · ${allSongs.length}`
                      : "From the catalog"
                }
              />
                  {error ? (
                <Pressable onPress={() => void load()} accessibilityRole="button">
                  <Text style={styles.error}>{error} Tap to retry.</Text>
                </Pressable>
              ) : fromCache && refreshing ? (
                <Text style={styles.cacheHint}>Showing cached catalog while refreshing…</Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {error ?? "No songs available yet."}
            </Text>
          ) : null
        }
        ListFooterComponent={
          hasMore ? (
            <Text style={styles.footer}>
              Showing {songs.length} of {allSongs.length} · scroll for more (page size{" "}
              {CATALOG_PAGE_SIZE})
            </Text>
          ) : allSongs.length > CATALOG_PAGE_SIZE ? (
            <Text style={styles.footer}>All {allSongs.length} songs loaded</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <CompactSongRow
            song={item}
            onPress={() => router.push(href(`/song/${item.id}`))}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...typography.h1, color: colors.textPrimary },
  list: { paddingHorizontal: spacing.lg },
  listHeader: { paddingTop: spacing.lg },
  categorySection: {
    marginBottom: spacing.section,
  },
  collectionsSection: {
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  collectionsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    ...softShadow(1),
  },
  collectionsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionsTitle: { ...typography.label, fontSize: 15, color: colors.textPrimary },
  collectionsSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  popularHeader: { marginTop: spacing.xl, marginBottom: spacing.sm, gap: spacing.xs },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  cacheHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.xl },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
})
