import { useCallback, useMemo, useState } from "react"
import { FlatList, Platform, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SpRound } from "@/components/song-v2/SpUi"
import { CollectionTile } from "@/components/songs-v2/CollectionTile"
import { CloseGlyph, ChevronRightGlyph, SearchGlyph } from "@/components/songs-v2/Glyphs"
import { ChipsRow, CollageCover, LIST_SIDE } from "@/components/songs-v2/ListParts"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { allCollections } from "@/data/collections"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { useSpTheme } from "@/hooks/useSpTheme"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { MOCK_TILES, MOCK_TOTAL } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import {
  EMPTY_COLLECTIONS_TEXT,
  buildCollectionEntries,
  collectionHref,
  collectionsCountLabel,
  filterCollections,
  kindChips,
  type CollectionEntry,
  type CollectionKindFilter,
  type MoodSource,
} from "@/lib/songsV2/collectionsIndex"
import { collageCoverIds, songCountText } from "@/lib/songsV2/listPage"
import { SPECIAL_TILES } from "@/lib/songsV2/collections"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

/** The catalog is 5,018 songs; shown until the list has loaded. */
const CATALOG_SIZE = 5018
const SIDE = 16
const GAP = 10
const REVEALED_TILES = 6

/** The six special tiles of the Songs shelf, counted the way the shelf counts them. */
function moodSources(): MoodSource[] {
  return SPECIAL_TILES.map((tile) => {
    const mock = MOCKUP_DATA ? MOCK_TILES.find((t) => t.id === tile.id) : undefined
    const count = mock ? Number.parseInt(mock.countLabel, 10) || 0 : songNumbersForCategory(tile.browseId).length
    return { id: mock?.id ?? tile.browseId, label: tile.label, count }
  })
}

/**
 * All collections: every collection of the app (festivals, themes, moods, occasions, seasons, languages)
 * as a grid of tiles, with a search by name and a chip per kind. An "All songs" tile on top keeps the
 * whole catalogue one tap away. A tile opens the collection page (songs-v2-collection).
 */
export default function CollectionsV2Screen() {
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const catalog = useSongsV2Catalog()

  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<CollectionKindFilter>("all")
  const [width, setWidth] = useState(0)

  const entries = useMemo(() => buildCollectionEntries(allCollections, moodSources()), [])
  const chips = useMemo(() => kindChips(entries), [entries])
  const shown = useMemo(() => filterCollections(entries, query, kind), [entries, query, kind])
  const searching = query.trim().length > 0
  const total = MOCKUP_DATA ? MOCK_TOTAL : catalog.entries.length || CATALOG_SIZE
  const coverIds = useMemo(() => collageCoverIds(Array.from({ length: 48 }, (_, i) => i + 1)), [])

  const tileWidth = Math.floor(((width || 390) - SIDE * 2 - GAP) / 2)
  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width)), [])
  const open = useCallback((entry: CollectionEntry) => router.push(href(collectionHref(entry))), [router])
  const clear = useCallback(() => {
    setQuery("")
    setKind("all")
  }, [])

  const allSongs = (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`All songs, ${songCountText(total)}`}
      onPress={() => router.push(href("/songs-v2-index"))}
      pressedScale={0.98}
      outerStyle={styles.allOuter}
      style={[styles.all, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.allCover}>
        <CollageCover ids={coverIds} tint={theme.inner} />
      </View>
      <View style={styles.allText}>
        <Text style={[styles.allTitle, { color: theme.textHeading }]} numberOfLines={1}>
          All songs
        </Text>
        <Text style={[styles.allSub, { color: theme.textBody }]} numberOfLines={1}>
          {songCountText(total)} · the whole catalogue
        </Text>
      </View>
      <ChevronRightGlyph color={theme.textBody} />
    </Press>
  )

  const renderItem = useCallback(
    ({ item, index }: { item: CollectionEntry; index: number }) => {
      const tile = <CollectionTile entry={item} width={tileWidth} onOpen={open} />
      return index < REVEALED_TILES ? <SongsReveal index={4 + index}>{tile}</SongsReveal> : tile
    },
    [tileWidth, open],
  )

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]} onLayout={onLayout}>
        {/* the pinned bar: back, title, search and kinds stay while the grid scrolls */}
        <View style={[styles.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
          <SongsReveal index={0}>
            <View style={styles.titleRow}>
              <SpRound t={sp} icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
              <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header">
                Collections
              </Text>
              <Text style={[styles.count, { color: theme.textBody }]} numberOfLines={1}>
                {collectionsCountLabel(shown.length, entries.length)}
              </Text>
            </View>
          </SongsReveal>
          <SongsReveal index={1}>
            <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <SearchGlyph color={theme.textBody} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search collections"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Search collections"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
                style={[styles.input, { color: theme.textHeading }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
              />
              {query ? (
                <Press accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")} pressedScale={0.88} style={styles.clearBtn}>
                  <CloseGlyph size={18} color={theme.textBody} />
                </Press>
              ) : null}
            </View>
          </SongsReveal>
          <SongsReveal index={2}>
            <ChipsRow theme={theme} chips={chips} active={kind} onPick={(id) => setKind(id as CollectionKindFilter)} />
          </SongsReveal>
        </View>

        <FlatList
          data={shown}
          keyExtractor={(entry) => `${entry.kind}:${entry.id}`}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.column}
          ListHeaderComponent={!searching && kind === "all" ? <SongsReveal index={3}>{allSongs}</SongsReveal> : null}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={[styles.empty, { color: theme.textBody }]}>{EMPTY_COLLECTIONS_TEXT}</Text>
              <Press accessibilityRole="button" accessibilityLabel="Clear search and kinds" onPress={clear} pressedScale={0.96} style={styles.emptyBtn}>
                <Text style={[styles.emptyLink, { color: theme.accent }]}>Show all collections</Text>
              </Press>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: hasSong ? 180 : 130 }}
          initialNumToRender={12}
          windowSize={7}
        />
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { zIndex: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 10, paddingRight: LIST_SIDE, height: 56 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 30, lineHeight: 32, letterSpacing: -0.6, textTransform: "uppercase" },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums"] },
  search: {
    height: 48,
    marginHorizontal: SIDE,
    marginTop: 8,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, height: 48, fontFamily: amFonts.medium, fontSize: 16 },
  clearBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  column: { gap: GAP, paddingHorizontal: SIDE, marginBottom: GAP },
  allOuter: { marginHorizontal: SIDE, marginBottom: GAP },
  all: { height: 100, borderRadius: 24, borderWidth: 1, paddingLeft: 8, paddingRight: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  allCover: { borderRadius: 16, overflow: "hidden" },
  allText: { flex: 1, minWidth: 0, gap: 3 },
  allTitle: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 24, letterSpacing: -0.33, textTransform: "uppercase" },
  allSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  emptyBox: { paddingHorizontal: LIST_SIDE, paddingTop: 20, gap: 4 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  emptyBtn: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  emptyLink: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
