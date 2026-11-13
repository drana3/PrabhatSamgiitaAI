import { useCallback, useMemo, useState } from "react"
import { FlatList, Platform, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { SpRound } from "@/components/song-v2/SpUi"
import { CollectionCard } from "@/components/songs-v2/CollectionCard"
import { CloseGlyph, ChevronRightGlyph, SearchGlyph } from "@/components/songs-v2/Glyphs"
import { ChipsRow, CollageCover, LIST_SIDE } from "@/components/songs-v2/ListParts"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { allCollections } from "@/data/collections"
import { PS_ALL } from "@/lib/psCollections/data"
import { collectionPhoto } from "@/lib/psCollections/photo"
import { buildSections, filterSections, type CollectionSection, type CollectionTileData, type SectionId } from "@/lib/psCollections/sections"
import { songCountLabel } from "@/lib/songsV2/collections"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { useSpTheme } from "@/hooks/useSpTheme"
import { songNumbersForCategory } from "@/lib/categorySongs"
import {
  emptyCollectionsText,
  buildCollectionEntries,
  collectionHref,
  normalizeText,
  KIND_ORDER,
  kindChips,
  type CollectionKindFilter,
  type MoodSource,
} from "@/lib/songsV2/collectionsIndex"
import { collageCoverIds, songCountText } from "@/lib/songsV2/listPage"
import { SPECIAL_TILES } from "@/lib/songsV2/collections"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

/** The catalog is 5,018 songs; shown until the list has loaded. */
const CATALOG_SIZE = 5018
type Row = { key: string; head?: CollectionSection; tiles?: CollectionTileData[] }
const SIDE = 16
const GAP = 10
const REVEALED_TILES = 6

/** The six special tiles of the Songs shelf, counted the way the shelf counts them. */
function moodSources(): MoodSource[] {
  return SPECIAL_TILES.map((tile) => {
    return { id: tile.browseId, label: tile.label, count: songNumbersForCategory(tile.browseId).length }
  })
}

/**
 * All collections: every collection of the app (festivals, themes, moods, occasions, seasons, languages)
 * as a grid of tiles, with a search by name and a chip per kind. An "All songs" tile on top keeps the
 * whole catalogue one tap away. A tile opens the collection page (songs-v2-collection).
 */
export default function CollectionsV2Screen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = useScreenTop()
  const openedAt = useRevealClock()
  const bottomInset = useScrollBottomInset()
  const catalog = useSongsV2Catalog()

  const [query, setQuery] = useState("")
  // ?kind=mood opens with that chip chosen (the Moods, Languages and Festivals tiles of Search)
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>()
  const [kind, setKind] = useState<CollectionKindFilter>(() => (KIND_ORDER as readonly string[]).includes(String(kindParam)) ? (kindParam as CollectionKindFilter) : "all")
  const [width, setWidth] = useState(0)

  // The old (site) collections stay as they were; the Prabhat Samgiita collections come in their own sections above them.
  const entries = useMemo(() => buildCollectionEntries(allCollections, moodSources()), [t])
  const sections = useMemo(
    () =>
      buildSections({
        ps: PS_ALL,
        site: entries,
        siteHref: (entry) => collectionHref(entry),
        titleOf: (id) => t(`psColl.section.${id}` as const),
        countLabel: songCountLabel,
      }),
    [entries, t],
  )
  const [section, setSection] = useState<SectionId | "all">(() => ((KIND_ORDER as readonly string[]).includes(String(kindParam)) ? "site" : "all"))
  const chips = useMemo(
    () => [{ id: "all", label: t("psColl.chips.all") }, ...sections.map((x) => ({ id: x.id as string, label: x.title }))],
    [sections, t],
  )
  const siteChips = useMemo(() => kindChips(entries), [entries])
  const shown = useMemo(() => filterSections(sections, query, normalizeText, section, kind), [sections, query, section, kind])
  const shownCount = shown.reduce((n, x) => n + x.tiles.length, 0)
  const totalCount = sections.reduce((n, x) => n + x.tiles.length, 0)
  const searching = query.trim().length > 0
  const total = catalog.entries.length || CATALOG_SIZE
  const coverIds = useMemo(() => collageCoverIds(Array.from({ length: 48 }, (_, i) => i + 1)), [])

  const tileWidth = Math.floor(((width || 390) - SIDE * 2 - GAP) / 2)
  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width)), [])
  const open = useCallback((tile: CollectionTileData) => router.push(href(tile.href)), [router])
  const clear = useCallback(() => {
    setQuery("")
    setKind("all")
    setSection("all")
  }, [])
  // one list: a section header, then its tiles two to a row
  const rows = useMemo(() => {
    const out: Row[] = []
    for (const x of shown) {
      out.push({ key: `h:${x.id}`, head: x })
      for (let i = 0; i < x.tiles.length; i += 2) out.push({ key: `r:${x.id}:${i}`, tiles: x.tiles.slice(i, i + 2) })
    }
    return out
  }, [shown])

  const allSongs = (
    <Press
      accessibilityRole="button"
      accessibilityLabel={t("songs.coll.allSongsA11y", { songs: songCountText(total) })}
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
          {t("songs.allSongs")}
        </Text>
        <Text style={[styles.allSub, { color: theme.textBody }]} numberOfLines={1}>
          {t("songs.coll.wholeCatalog", { songs: songCountText(total) })}
        </Text>
      </View>
      <ChevronRightGlyph color={theme.textBody} />
    </Press>
  )

  const renderItem = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      let body
      if (item.head) {
        body = (
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header">
              {item.head.title}
            </Text>
            <Text style={[styles.count, { color: theme.textBody }]}>{item.head.tiles.length}</Text>
          </View>
        )
      } else {
        body = (
          <View style={styles.column}>
            {item.tiles?.map((tile) => (
              <CollectionCard
                key={tile.key}
                kind="theme"
                toneIndex={0}
                title={tile.label}
                caption={tile.countLabel}
                label={`${tile.label}, ${tile.countLabel}`}
                width={tileWidth}
                photo={collectionPhoto(tile.photoSeed, tile.photoMood).thumb}
                onPress={() => open(tile)}
              />
            ))}
          </View>
        )
      }
      return index < REVEALED_TILES ? <SongsReveal index={4 + index}>{body}</SongsReveal> : body
    },
    [tileWidth, open, theme],
  )

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]} onLayout={onLayout}>
        {/* the pinned bar: back, title, search and kinds stay while the grid scrolls */}
        <View style={[styles.bar, { paddingTop: inset, backgroundColor: theme.page }]}>
          <SongsReveal index={0}>
            <View style={styles.titleRow}>
              <SpRound t={sp} icon="back" label={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE)))} />
              <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1} accessibilityRole="header">
                {t("songs.coll.title")}
              </Text>
              <Text style={[styles.count, { color: theme.textBody }]} numberOfLines={1}>
                {shownCount === totalCount ? t("songs.collections.count", { count: totalCount }) : t("songs.shownOf", { shown: shownCount, total: totalCount })}
              </Text>
            </View>
          </SongsReveal>
          <SongsReveal index={1}>
            <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <SearchGlyph color={theme.textBody} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("songs.coll.search")}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t("songs.coll.search")}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
                style={[styles.input, { color: theme.textHeading }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
              />
              {query ? (
                <Press accessibilityRole="button" accessibilityLabel={t("songs.coll.clearSearch")} onPress={() => setQuery("")} pressedScale={0.88} style={styles.clearBtn}>
                  <CloseGlyph size={18} color={theme.textBody} />
                </Press>
              ) : null}
            </View>
          </SongsReveal>
          <SongsReveal index={2}>
            <ChipsRow theme={theme} chips={chips} active={section} onPick={(id) => { setSection(id as SectionId | "all"); setKind("all") }} />
            {section === "site" ? <ChipsRow theme={theme} chips={siteChips} active={kind} onPick={(id) => setKind(id as CollectionKindFilter)} /> : null}
          </SongsReveal>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          ListHeaderComponent={!searching && section === "all" ? <SongsReveal index={3}>{allSongs}</SongsReveal> : null}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={[styles.empty, { color: theme.textBody }]}>{emptyCollectionsText()}</Text>
              <Press accessibilityRole="button" accessibilityLabel={t("songs.coll.clearAll")} onPress={clear} pressedScale={0.96} style={styles.emptyBtn}>
                <Text style={[styles.emptyLink, { color: theme.accent }]}>{t("songs.coll.showAll")}</Text>
              </Press>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: bottomInset }}
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
  column: { flexDirection: "row", gap: GAP, paddingHorizontal: SIDE, marginBottom: GAP },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: SIDE + 4, paddingTop: 16, paddingBottom: 12 },
  sectionTitle: { flex: 1, fontFamily: amFonts.display, fontSize: 22, lineHeight: 24, letterSpacing: -0.33, textTransform: "uppercase" },
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
